// events/interactionCreate.js
const { PermissionFlagsBits } = require("discord.js");

module.exports = {
  name: "interactionCreate",
  async execute(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // กัน edge case: ถ้าสิทธิ์คำสั่งใน Discord ถูกแก้ไข
    const needsAdmin =
      command.data.default_member_permissions?.has?.(PermissionFlagsBits.Administrator) ||
      command.data.default_member_permissions === PermissionFlagsBits.Administrator;

    if (needsAdmin && !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ content: "❌ ต้องเป็น Admin เท่านั้น", ephemeral: true });
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(error);
      const content = "❌ มีบางอย่างผิดพลาด!";
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content, ephemeral: true });
      } else {
        await interaction.reply({ content, ephemeral: true });
      }
    }
  },
};
