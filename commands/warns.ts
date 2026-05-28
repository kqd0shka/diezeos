import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { WarnService } from "../services/warn.service";

export const warns = {
    data: new SlashCommandBuilder()
        .setName("warns")
        .setDescription("Показать ваши активные предупреждения"),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const warns = WarnService.getActiveWarns(interaction.user.id, interaction.guild.id);
        
        if (warns.length === 0) {
            return interaction.reply({ content: "✅ У вас нет активных предупреждений!", flags: 64 });
        }
        
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Ваши предупреждения (${warns.length}/3)`)
            .setColor(0xFFA500)
            .addFields(
                ...warns.map((w, i) => ({
                    name: `#${i + 1} • <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`,
                    value: `📝 ${w.reason}\n👮 <@${w.moderatorId}>`,
                    inline: false
                }))
            )
            .setFooter({ text: "3 предупреждения = автоматический бан на 1 день" })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};