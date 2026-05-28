import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { WarnService } from "../services/warn.service";

export const paywarn = {
    data: new SlashCommandBuilder()
        .setName("paywarn")
        .setDescription("Снять последнее предупреждение за 10,000 монет")
        .addStringOption(opt => opt.setName("reason").setDescription("Причина (необязательно)")),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        const reason = interaction.options.getString("reason") ?? undefined;
        
        await interaction.deferReply({ flags: 64 });

        const result = await WarnService.removeWarnByUser(
            interaction.guild,
            interaction.user,
            reason
        );

        if (!result.success) return interaction.editReply({ content: result.error });
        await interaction.editReply({ content: `✅ Предупреждение снято! Списано ${result.cost} монет. Осталось варнов: ${result.remaining}` });
    }
};