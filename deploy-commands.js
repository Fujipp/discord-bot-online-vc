// deploy-commands.js  (fixed & hardened)
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");

// ===== helpers =====
const parseIds = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const allowUsers = parseIds(process.env.SPECIAL_USER_IDS);
const allowRoles = parseIds(process.env.SPECIAL_ROLE_IDS);

const { TOKENS = "", AUTO_DEPLOY = "true", FORCE_DEPLOY = "false" } = process.env;
if (AUTO_DEPLOY.toLowerCase() === "false") {
  console.log("⚠️ AUTO_DEPLOY=false → ข้ามการลงทะเบียนคำสั่ง");
  process.exit(0);
}

const tokens = TOKENS.split(",").map(s => s.trim()).filter(Boolean);
if (tokens.length === 0) {
  console.error("❌ ต้องตั้งค่า TOKENS ใน .env (คั่นด้วย , เมื่อมีหลายบอท)");
  process.exit(1);
}

const { loadCommands } = require("./utils/commandLoader");
const { json: commandsJSON } = loadCommands();
const payload = JSON.stringify(commandsJSON);
const payloadHash = crypto.createHash("sha256").update(payload).digest("hex");

const CACHE_DIR = path.join(__dirname, ".cache");
const GUILD_DIR = path.join(CACHE_DIR, "guilds");
const HASH_FILE = path.join(CACHE_DIR, "commands.hash");

if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR);
if (!fs.existsSync(GUILD_DIR)) fs.mkdirSync(GUILD_DIR);

const force = FORCE_DEPLOY.toLowerCase() === "true";
const oldHash = fs.existsSync(HASH_FILE) ? fs.readFileSync(HASH_FILE, "utf8").trim() : null;
const payloadChanged = oldHash !== payloadHash;

// ===== allowlist applier (best-effort) =====
async function tryGrantAllowlist({ client, rest, appId, guildId, commands, token }) {
  if (!allowUsers.length && !allowRoles.length) return;

  // build permissions payload (v1 style)
  const perms = [
    ...allowUsers.map(id => ({ id, type: 1, permission: true })), // 1 = USER
    ...allowRoles.map(id => ({ id, type: 2, permission: true })), // 2 = ROLE
  ];
  if (!perms.length) return;

  for (const c of commands) {
    let done = false;

    // A) ลองผ่าน Manager (ถ้ามีในเวอร์ชันนี้)
    try {
      const mgr = client?.application?.commands?.permissions;
      if (mgr?.add) {
        await mgr.add({ guild: guildId, command: c.id, token, permissions: perms });
        console.log(`🔐 allowlist via Manager → cmd=${c.name} guild=${guildId}`);
        done = true;
      }
    } catch (e) {
      // เงียบไว้แล้วไปลอง REST ต่อ
    }

    // B) ลองผ่าน REST (รองรับบางเวอร์ชันของ API)
    if (!done) {
      // เส้นทาง REST มีความต่างกันตามเวอร์ชัน API/ไลบรารี → ลองทีละแบบ
      const routesToTry = [];
      if (Routes.applicationGuildCommandPermissions) {
        routesToTry.push(Routes.applicationGuildCommandPermissions(appId, guildId, c.id));
      }
      if (Routes.applicationCommandPermissions) {
        routesToTry.push(Routes.applicationCommandPermissions(appId, guildId, c.id));
      }

      for (const route of routesToTry) {
        try {
          await rest.put(route, { body: { permissions: perms } });
          console.log(`🔐 allowlist via REST → cmd=${c.name} guild=${guildId}`);
          done = true;
          break;
        } catch (e) {
          // ลองเส้นทางถัดไป
        }
      }
    }

    if (!done) {
      console.log(
        `ℹ️ ตั้ง allowlist ผ่านโค้ดไม่ได้สำหรับ cmd=${c.name} guild=${guildId} — ` +
        `กรุณาตรวจใน Server Settings → Integrations (Discord อาจปิด API เส้นนี้ในเวอร์ชันปัจจุบัน)`,
      );
    }
  }
}

// ===== main =====
(async () => {
  for (const [i, token] of tokens.entries()) {
    console.log(`\n===[ Bot #${i + 1} ]================================`);
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    await client.login(token);
    await client.application.fetch();
    const appId = client.application.id;
    const rest = new REST({ version: "10" }).setToken(token);

    const guildIds = [...client.guilds.cache.keys()];
    console.log(`👤 ${client.user.tag} | appId=${appId} | guilds=${guildIds.length}`);

    const guildCacheFile = path.join(GUILD_DIR, `${appId}.json`);
    const prevGuilds = fs.existsSync(guildCacheFile)
      ? JSON.parse(fs.readFileSync(guildCacheFile, "utf8"))
      : [];

    const isNewGuild = new Set(guildIds.filter(id => !prevGuilds.includes(id)));
    const shouldFullDeploy = force || payloadChanged;

    if (shouldFullDeploy) {
      console.log("🟡 Payload เปลี่ยนหรือ FORCE_DEPLOY=true → deploy ทุกกิลด์");
    } else if (isNewGuild.size) {
      console.log(`🟨 พบกิลด์ใหม่ ${isNewGuild.size} แห่ง → deploy เฉพาะกิลด์ใหม่`);
    } else {
      console.log("⏭ ไม่มีการเปลี่ยนแปลงและไม่มีกิลด์ใหม่ → ข้ามบอทนี้");
      await client.destroy();
      continue;
    }

    const targets = shouldFullDeploy ? guildIds : Array.from(isNewGuild);
    for (const gid of targets) {
      try {
        // ลงทะเบียนคำสั่ง
        await rest.put(Routes.applicationGuildCommands(appId, gid), { body: commandsJSON });
        console.log(`✅ ลงทะเบียนคำสั่งให้ guild=${gid} เรียบร้อย`);

        // ดึงรายการคำสั่งล่าสุดของกิลด์นี้
        const cmds = await rest.get(Routes.applicationGuildCommands(appId, gid));

        // ตั้ง allowlist (best-effort)
        await tryGrantAllowlist({ client, rest, appId, guildId: gid, commands: cmds, token });
      } catch (e) {
        console.error(`❌ ลงทะเบียน/ตั้งสิทธิ์ล้มเหลว guild=${gid}:`, e?.message || e);
      }
    }

    // อัปเดตแคชกิลด์ แล้วปิด client
    fs.writeFileSync(guildCacheFile, JSON.stringify(guildIds), "utf8");
    await client.destroy();
  }

  // บันทึกแฮชล่าสุด
  fs.writeFileSync(HASH_FILE, payloadHash, "utf8");
  console.log("\n✅ เสร็จสิ้นการลงทะเบียนคำสั่งทุกบอท");
  process.exit(0);
})();
