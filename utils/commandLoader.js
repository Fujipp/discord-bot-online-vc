// utils/commandLoader.js
const fs = require("fs");
const path = require("path");
const { Collection } = require("discord.js");

function loadCommands() {
  const commandsPath = path.join(__dirname, "..", "commands");
  const collection = new Collection();
  const json = [];

  for (const file of fs.readdirSync(commandsPath)) {
    if (!file.endsWith(".js")) continue;
    const cmd = require(path.join(commandsPath, file));
    if (!cmd?.data) continue;
    collection.set(cmd.data.name, cmd);
    json.push(cmd.data.toJSON());
  }
  return { collection, json };
}

module.exports = { loadCommands };
