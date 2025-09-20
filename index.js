// index.js
require("dotenv").config();
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Client, GatewayIntentBits, Collection, Events } = require("discord.js");
const { loadCommands } = require("./utils/commandLoader");

// ---------- Health server (อยู่ในโปรเซสเดียวกับบอท) ----------
(function startHealth() {
  if ((process.env.DISABLE_HEALTH || "").toLowerCase() === "true") {
    console.log("ℹ️ Health server disabled by env.");
    return;
  }
  const app = express();
  app.get("/", (_req, res) => res.send("Bot is running ✅"));
  const PORT = Number(process.env.PORT) || 3000;
  const server = http.createServer(app);
  server.on("listening", () => console.log(`🌐 Health server listening on ${PORT}`));
  server.on("error", (err) => {
    if (err?.code === "EADDRINUSE") {
      console.log(`ℹ️ Port ${PORT} already in use → skip health server (another instance likely running).`);
    } else {
      console.error("Health server error:", err);
    }
  });
  server.listen(PORT);
})();

// ---------- Discord multi-bot ----------
const tokens = (process.env.TOKENS || "").split(",").map(s => s.trim()).filter(Boolean);
if (!tokens.length) {
  console.error("❌ ไม่พบ TOKENS ใน .env");
  process.exit(1);
}

const eventsPath = path.join(__dirname, "events");
const { collection: commandCollection } = loadCommands();

function bindEvents(client) {
  for (const file of fs.readdirSync(eventsPath)) {
    if (!file.endsWith(".js")) continue;
    const event = require(path.join(eventsPath, file));
    if (event.once) client.once(event.name, (...args) => event.execute(...args, client));
    else client.on(event.name, (...args) => event.execute(...args, client));
  }
}

process.on("unhandledRejection", (e) => console.error("UNHANDLED REJECTION:", e));
process.on("uncaughtException",  (e) => console.error("UNCAUGHT EXCEPTION:", e));

(async () => {
  for (const [i, token] of tokens.entries()) {
    const client = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
    });
    client.commands = new Collection(commandCollection);

    bindEvents(client);

    client.once(Events.ClientReady, () => {
      console.log(`✅ [#${i + 1}] Logged in as ${client.user.tag}`);
    });

    client.login(token).catch(err => {
      console.error(`❌ [#${i + 1}] Login failed:`, err?.message || err);
    });
  }
})();
