import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { MuteService } from "../services/mute.service";

export const mute = {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Заглушить пользователя в голосовом канале")
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .addUserOption(opt => opt.setName("user").setDescription("Пользователь").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Причина").setRequired(true))
        .addStringOption(opt => opt.setName("duration").setDescription("Длительность: 1h 30m или 0").setRequired(true))
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("Тип заглушения")
                .setRequired(true)
                .addChoices(
                    { name: " Микрофон", value: "voice" },
                    { name: "🎧 Микрофон + Звук", value: "deaf" },
                    { name: "🔇 Полное", value: "both" }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || !interaction.member) return;
        await interaction.deferReply({ flags: 64 });

        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);
        const duration = interaction.options.getString("duration", true);
        const muteType = interaction.options.getString("type", true) as 'voice' | 'deafen' | 'both';
        const moderator = await interaction.guild.members.fetch(interaction.member.user.id);

        const result = await MuteService.applyMute(
            interaction.guild,
            target,
            moderator,
            { reason, duration, muteType }
        );

        if (!result.success) return interaction.editReply({ content: result.error });
        await interaction.editReply({ content: `✅ <@${target.id}> заглушен (${muteType}).\nПричина: ${reason}` });
    }
};