import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../database/database";

export const appeal = {
    data: new SlashCommandBuilder()
        .setName("appeal")
        .setDescription("Подать апелляцию на бан (работает в ЛС с ботом)")
        .addStringOption(opt => 
            opt.setName("reason")
                .setDescription("Почему вас стоит разбанить?")
                .setRequired(true)
                .setMaxLength(500)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        
        // Ищем активный бан на любом сервере, где есть бот
        const bans = db.prepare(`
            SELECT guildId, reason, duration, appealed 
            FROM bans 
            WHERE userId = ? AND appealed = 0
        `).all(userId) as Array<{ guildId: string; reason: string; duration: string; appealed: number }>;

        if (bans.length === 0) {
            return interaction.reply({ 
                content: "❌ У вас нет активных банов, по которым можно подать апелляцию.", 
                flags: 64 
            });
        }

        // Если банов несколько — берём первый (можно усложнить выбор)
        const ban = bans[0];
        const guild = await interaction.client.guilds.fetch(ban.guildId).catch(() => null);
        
        if (!guild) {
            return interaction.reply({ content: "❌ Сервер не найден.", flags: 64 });
        }

        const reason = interaction.options.getString("reason", true);

        // Сохраняем апелляцию
        db.prepare(`
            UPDATE bans SET appealed = 1, appealText = ?, appealStatus = 'pending'
            WHERE userId = ? AND guildId = ?
        `).run(reason, userId, guild.id);

        // Пересылаем в канал логов
        const settings = db.prepare("SELECT logChannelId FROM guild_settings WHERE guildId = ?").get(guild.id) as any;
        if (settings?.logChannelId) {
            const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
            if (channel?.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setTitle("📨 Новая апелляция")
                    .setColor(0xFFA500)
                    .addFields(
                        { name: "👤 Пользователь", value: `<@${userId}>`, inline: true },
                        { name: "📝 Причина бана", value: ban.reason, inline: false },
                        { name: "⏱️ Длительность", value: ban.duration, inline: true },
                        { name: "💬 Апелляция", value: reason, inline: false }
                    )
                    .setFooter({ text: `ID: ${userId}-${guild.id}` })
                    .setTimestamp();

                const components = [
                    {
                        type: 1,
                        components: [
                            { type: 2, style: 3, label: "✅ Одобрить", custom_id: `appeal_approve_${userId}_${guild.id}`, emoji: "✅" },
                            { type: 2, style: 4, label: "❌ Отклонить", custom_id: `appeal_reject_${userId}_${guild.id}`, emoji: "❌" }
                        ]
                    }
                ] as any;

                await channel.send({ embeds: [embed], components }).catch(() => {});
            }
        }

        await interaction.reply({ 
            content: "✅ Апелляция принята! Ожидайте ответа модераторов. Вы получите уведомление в ЛС.", 
            flags: 64 
        });
    }
};