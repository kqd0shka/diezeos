// src/commands/unban.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { db } from "../database/database";

export const unban = {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Разбанить пользователя")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(opt =>
            opt.setName("user_id")
                .setDescription("ID пользователя для разбана")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("reason")
                .setDescription("Причина разбана")
                .setRequired(false)
                .setMaxLength(200)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const userId = interaction.options.getString("user_id", true);
        const reason = interaction.options.getString("reason") || "По запросу модератора";
        
        await interaction.deferReply({ flags: 64 });

        try {
            // Удаляем из БД
            const ban = db.prepare("SELECT * FROM bans WHERE userId = ? AND guildId = ?").get(userId, interaction.guild!.id) as any;
            db.prepare("DELETE FROM bans WHERE userId = ? AND guildId = ?").run(userId, interaction.guild!.id);

            // Разбаниваем через Discord API
            await interaction.guild!.bans.remove(userId, `🔓 ${interaction.user.tag}: ${reason}`);

            // Обновляем историю
            if (ban) {
                db.prepare(`
                    UPDATE ban_history SET unbannedBy = ?, unbannedAt = ?, unbannedReason = ?
                    WHERE userId = ? AND guildId = ? AND unbannedAt IS NULL
                `).run(interaction.user.id, new Date().toISOString(), reason, userId, interaction.guild!.id);
            }

            const embed = new EmbedBuilder()
                .setTitle("✅ Пользователь разбанен")
                .setColor(0x22c55e)
                .addFields(
                    { name: "👤 Пользователь", value: `<@${userId}>`, inline: true },
                    { name: "📝 Причина", value: reason, inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Уведомление пользователю
            try {
                const user = await interaction.client.users.fetch(userId);
                await user.send({
                    content: `✅ Ваш бан на сервере **${interaction.guild!.name}** был снят.\nПричина: ${reason}`
                });
            } catch {}

        } catch (error: any) {
            await interaction.editReply({ content: `❌ Ошибка: ${error.message}` });
        }
    }
};