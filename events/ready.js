// events/ready.js
const { Events } = require("discord.js");

module.exports = {
  // v14 จะ resolve เป็น 'ready', v15 จะเป็น 'clientReady' อัตโนมัติ
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Logged in as ${client.user.tag}`);
  },
};
