// commands/leave.js
const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getVoiceConnection } = require("@discordjs/voice");

const parseIds = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const ALLOW_USERS = parseIds(process.env.SPECIAL_USER_IDS);
const ALLOW_ROLES = parseIds(process.env.SPECIAL_ROLE_IDS);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leave")
    .setDescription("ออกจากห้อง voice (Admin/ผู้ใช้พิเศษ)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // ซ่อนจากคนทั่วไป
    .setDMPermission(false),

  async execute(interaction) {
    // อนุญาต: แอดมิน, user พิเศษ, role พิเศษ
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isAllowUser = ALLOW_USERS.includes(interaction.user.id);
    const isAllowRole = interaction.member?.roles?.cache?.some(r => ALLOW_ROLES.includes(r.id));

    if (!(isAdmin || isAllowUser || isAllowRole)) {
      return interaction.reply({ content: "❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้", ephemeral: true });
    }

    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
      return interaction.reply({ content: "❌ บอทไม่ได้อยู่ในห้อง voice", ephemeral: true });
    }

    try {
      connection.destroy();
      await interaction.reply({ content: "👋 ออกจากห้องเรียบร้อยแล้ว!", ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `⚠️ มีปัญหาในการออกจากห้อง: ${e?.message || e}`, ephemeral: true });
    }
  },
};
