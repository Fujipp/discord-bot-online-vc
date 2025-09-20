const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { attachKeepAlive } = require("../utils/keepAlive");
const { saveGuildChannel } = require("../utils/voiceStore");

const parseIds = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
const ALLOW_USERS = parseIds(process.env.SPECIAL_USER_IDS);
const ALLOW_ROLES = parseIds(process.env.SPECIAL_ROLE_IDS);

module.exports = {
  data: new SlashCommandBuilder()
    .setName("join")
    .setDescription("เข้าห้อง voice ที่ระบุ หรือห้องที่คุณอยู่ (Admin/ผู้ใช้พิเศษ)")
    .addChannelOption(opt => opt.setName("channel").setDescription("เลือกห้องเสียงที่ให้บอทเข้า")
      .addChannelTypes(ChannelType.GuildVoice).setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .setDMPermission(false),

  async execute(interaction) {
    // ✅ ยอมรับ interaction ไว้ก่อน กันหมดอายุ
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parseIds = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
    const ALLOW_USERS = parseIds(process.env.SPECIAL_USER_IDS);
    const ALLOW_ROLES = parseIds(process.env.SPECIAL_ROLE_IDS);

    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const isAllowUser = ALLOW_USERS.includes(interaction.user.id);
    const isAllowRole = interaction.member?.roles?.cache?.some(r => ALLOW_ROLES.includes(r.id));
    if (!(isAdmin || isAllowUser || isAllowRole)) {
      return interaction.editReply({ content: "❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้" });
    }

    const picked = interaction.options.getChannel("channel");
    const channel = picked ?? interaction.member.voice.channel;
    if (!channel || channel.type !== ChannelType.GuildVoice) {
      return interaction.editReply({ content: "❌ ต้องเป็นห้อง Voice และต้องเลือกหรืออยู่ในห้องก่อน" });
    }

    const me = await interaction.guild.members.fetchMe();
    const perms = channel.permissionsFor(me);
    const need = [];
    if (!perms?.has(PermissionFlagsBits.Connect)) need.push("CONNECT");
    if (!perms?.has(PermissionFlagsBits.Speak))  need.push("SPEAK");
    if (need.length) {
      return interaction.editReply({ content: `❌ บอทไม่มีสิทธิ์ที่ \`${channel.name}\`: ${need.join(", ")}` });
    }

    const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
    try { getVoiceConnection(interaction.guild.id)?.destroy(); } catch {}

    const conn = joinVoiceChannel({
      channelId: channel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    // keep-alive + จำห้อง (ถ้าเปิด)
    if ((process.env.STAY_24_7 || "").toLowerCase() === "true") {
      const { attachKeepAlive } = require("../utils/keepAlive");
      const { saveGuildChannel } = require("../utils/voiceStore");
      attachKeepAlive(conn);
      saveGuildChannel(interaction.guild.id, channel.id);
    }

    return interaction.editReply({ content: `✅ เข้าห้อง \`${channel.name}\` เรียบร้อย!` });
  },
};