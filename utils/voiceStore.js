const fs = require("fs");
const path = require("path");
const FILE = path.join(__dirname, "../data/voice.json");

function readStore() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } }
function saveGuildChannel(guildId, channelId) {
  const j = readStore(); j[guildId] = { channelId, at: Date.now() };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(j, null, 2), "utf8");
}
function getAll() { return readStore(); }

module.exports = { saveGuildChannel, getAll };
