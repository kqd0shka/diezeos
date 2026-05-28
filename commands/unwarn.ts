import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, PermissionFlagsBits } from "discord.js";
import { WarnService } from "../services/warn.service";

export const unwarn = {
    data: new SlashCommandBuilder()
        .setName("unwarn")
        .setDescription("Снять последнее предупреждение")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt
            .setName("user")
            .setDescription("Пользователь")
            .setRequired(true))
        .addStringOption(opt => opt
            .setName("reason")
            .setDescription("Причина снятия")),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason") ?? undefined;
        
        await interaction.deferReply({ flags: 64 });

        const result = await WarnService.removeWarnByMod(
            interaction.guild,
            target,
            interaction.member as GuildMember,
            reason
        );

        if (!result.success) return interaction.editReply({ content: result.error });
        await interaction.editReply({ content: `✅ Предупреждение снято у <@${target.id}>. Осталось: ${result.remaining}` });
    }
};