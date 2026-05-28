import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { MuteService } from "../services/mute.service";

export const unmute = {
    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Снять заглушение с пользователя")
        .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers)
        .addUserOption(opt => opt.setName("user").setDescription("Пользователь").setRequired(true))
        .addStringOption(opt => opt.setName("reason").setDescription("Причина снятия"))
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("Тип снятия (по умолчанию: такое же, как при муте)")
                .addChoices(
                    { name: "🎤 Микрофон", value: "voice" },
                    { name: " Микрофон + Звук", value: "deafen" },
                    { name: "🔇 Полное", value: "both" }
                )
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || !interaction.member) return;
        await interaction.deferReply({ flags: 64 });

        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") || undefined;
        const muteType = interaction.options.getString("type") as 'voice' | 'deafen' | 'both' || 'both';
        const moderator = await interaction.guild.members.fetch(interaction.member.user.id);

        const result = await MuteService.removeMute(
            interaction.guild,
            target,
            moderator,
            muteType,
            reason
        );

        if (!result.success) return interaction.editReply({ content: result.error });
        await interaction.editReply({ content: `✅ Заглушение снято с <@${target.id}>.` });
    }
};