import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, PermissionFlagsBits } from "discord.js";
import { WarnService } from "../services/warn.service";

export const warn = {
    data: new SlashCommandBuilder()
        .setName("warn")
        .setDescription("Выдать предупреждение пользователю")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt   
            .setName("user")
            .setDescription("Пользователь")
            .setRequired(true))
        .addStringOption(opt => opt 
            .setName("reason")
            .setDescription("Причина")
            .setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);
        
        await interaction.deferReply({ flags: 64 });

        const result = await WarnService.addWarn(
            interaction.guild,
            target,
            interaction.member as GuildMember,
            reason,
            interaction.client
        );

        if (!result.success) return interaction.editReply({ content: result.error });
        await interaction.editReply({ content: `✅ <@${target.id}> получил предупреждение (${result.count}/3).\nПричина: ${reason}` });
    }
};