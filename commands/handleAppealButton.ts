import { ButtonInteraction, EmbedBuilder } from "discord.js";
import { db } from "../database/database";
import { BanService } from "../services/ban.service";

export async function handleAppealButton(interaction: ButtonInteraction) {
    if (!interaction.isButton()) return;
    
    // Парсим customId: appeal_approve_USERID_GUILDID или appeal_reject_USERID_GUILDID
    const parts = interaction.customId.split("_");
    const action = parts[1]; // "approve" или "reject"
    const userId = parts[2];
    const guildId = parts[3];

    if (!userId || !guildId) {
        return interaction.reply({ content: "❌ Ошибка: некорректный ID", flags: 64 });
    }

    // Проверяем права (только админы/модераторы)
    if (!interaction.memberPermissions?.has("BanMembers")) {
        return interaction.reply({ content: "❌ Недостаточно прав", flags: 64 });
    }

    const guild = await interaction.client.guilds.fetch(guildId).catch(() => null);
    if (!guild) {
        return interaction.reply({ content: "❌ Сервер не найден", flags: 64 });
    }

    const user = await interaction.client.users.fetch(userId).catch(() => null);
    if (!user) {
        return interaction.reply({ content: "❌ Пользователь не найден", flags: 64 });
    }

    const ban = db.prepare("SELECT * FROM bans WHERE userId = ? AND guildId = ?").get(userId, guildId) as any;
    if (!ban) {
        return interaction.reply({ content: "❌ Бан не найден в БД", flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });

    if (action === "approve") {
        // ✅ ОДОБРИТЬ апелляцию
        try {
            // Удаляем бан из БД
            db.prepare("DELETE FROM bans WHERE userId = ? AND guildId = ?").run(userId, guildId);

            // Разбаниваем через Discord API
            await guild.bans.remove(userId, `✅ Апелляция одобрена: ${interaction.user.tag}`).catch(() => {});

            // Обновляем историю
            db.prepare(`
                UPDATE ban_history SET 
                    unbannedBy = ?, 
                    unbannedAt = ?, 
                    unbannedReason = 'Апелляция одобрена'
                WHERE userId = ? AND guildId = ? AND unbannedAt IS NULL
            `).run(interaction.user.id, new Date().toISOString(), userId, guildId);

            // Уведомляем пользователя
            try {
                await user.send({
                    content: `✅ Ваша апелляция на сервере **${guild.name}** была **одобрена**!\nВас разбанили. Добро пожаловать обратно! 🎉`
                });
            } catch {}

            const embed = new EmbedBuilder()
                .setTitle("✅ Апелляция одобрена")
                .setColor(0x22c55e)
                .addFields(
                    { name: "👤 Пользователь", value: `<@${userId}>`, inline: true },
                    { name: "👮 Разбанен", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "📝 Причина бана", value: ban.reason, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Удаляем сообщение с апелляциями из канала (опционально)
            await interaction.message.delete().catch(() => {});

        } catch (error: any) {
            await interaction.editReply({ content: `❌ Ошибка при одобрении: ${error.message}` });
        }

    } else if (action === "reject") {
        // ❌ ОТКЛОНИТЬ апелляцию
        try {
            // Обновляем статус апелляции
            db.prepare(`
                UPDATE bans SET appealStatus = 'rejected'
                WHERE userId = ? AND guildId = ?
            `).run(userId, guildId);

            // Уведомляем пользователя
            try {
                await user.send({
                    content: `❌ Ваша апелляция на сервере **${guild.name}** была **отклонена**.\nБан остаётся в силе.`
                });
            } catch {}

            const embed = new EmbedBuilder()
                .setTitle("❌ Апелляция отклонена")
                .setColor(0xFF0000)
                .addFields(
                    { name: "👤 Пользователь", value: `<@${userId}>`, inline: true },
                    { name: "👮 Модератор", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "📝 Причина бана", value: ban.reason, inline: false }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // Удаляем кнопки, чтобы нельзя было нажать повторно
            await interaction.message.edit({ components: [] }).catch(() => {});

        } catch (error: any) {
            await interaction.editReply({ content: `❌ Ошибка при отклонении: ${error.message}` });
        }
    }
}