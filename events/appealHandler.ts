import { Client, Message, EmbedBuilder, TextChannel, User } from "discord.js";
import { BanService } from "../services/ban.service";
import { db } from "../database/database";

export function setupAppealHandler(client: Client) {
    const awaitAppeal = new Map<string, string>();

    client.on("messageCreate", async (message: Message) => {
        // Обрабатываем только ЛС от пользователей (не ботов)
        if (!message.guild && !message.author.bot) {
            const userId = message.author.id;
            const content = message.content.trim().toLowerCase();

            // 🔹 ШАГ 1: Пользователь пишет "appeal" или "апелляция"
            if (content === 'апелляция' || content === 'appeal') {
                const bans = db.prepare(`
                    SELECT guildId, reason, duration, appealed 
                    FROM bans 
                    WHERE userId = ? AND appealed = 0
                `).all(userId) as Array<{ guildId: string; reason: string; duration: string; appealed: number }>;

                if (bans.length === 0) {
                    await message.reply({ content: "❌ У вас нет активных банов, по которым можно подать апелляцию." });
                    return;
                }

                if (bans.length > 1) {
                    const guilds = await Promise.all(bans.map(b => client.guilds.fetch(b.guildId).catch(() => null)));
                    const embed = new EmbedBuilder()
                        .setTitle("❓ Уточните сервер")
                        .setDescription("У вас есть баны на нескольких серверах. Ответьте **номером** из списка:")
                        .addFields(...guilds.map((g, i) => ({
                            name: `${i + 1}. ${g?.name || `ID: ${bans[i].guildId}`}`,
                            value: `Причина: ${bans[i].reason}`,
                            inline: false
                        })))
                        .setFooter({ text: "Просто отправьте число (1, 2, 3...)" });
                    
                    awaitAppeal.set(userId, 'selecting');
                    await message.reply({ embeds: [embed] });
                    return;
                }

                // Один бан — сразу запрашиваем текст
                const ban = bans[0];
                awaitAppeal.set(userId, ban.guildId);
                
                const guild = await client.guilds.fetch(ban.guildId).catch(() => null);
                const embed = new EmbedBuilder()
                    .setTitle("📨 Подача апелляции")
                    .setDescription(`Сервер: **${guild?.name || 'Unknown'}**\n\n💬 **Напишите текст вашей апелляции** (почему вас стоит разбанить):`)
                    .setColor(0xFFA500)
                    .setFooter({ text: "Отправьте сообщение с текстом ниже" });
                
                await message.reply({ embeds: [embed] });
                return;
            }

            // 🔹 ШАГ 2: Пользователь выбрал сервер (если банов было несколько)
            if (awaitAppeal.get(userId) === 'selecting') {
                const choice = parseInt(content, 10);
                const bans = db.prepare(`
                    SELECT guildId FROM bans WHERE userId = ? AND appealed = 0
                `).all(userId) as Array<{ guildId: string }>;

                if (!isNaN(choice) && choice >= 1 && choice <= bans.length) {
                    const selectedGuildId = bans[choice - 1].guildId;
                    awaitAppeal.set(userId, selectedGuildId);
                    
                    await message.reply({ 
                        content: "✅ Сервер выбран. 💬 **Теперь напишите текст вашей апелляции**:" 
                    });
                } else {
                    await message.reply({ content: "❌ Неверный номер. Попробуйте ещё раз или напишите `appeal` для начала." });
                }
                return;
            }

            // 🔹 ШАГ 3: Пользователь отправил текст апелляции ✅ (ОДИН РАЗ, без дубликата!)
            const guildId = awaitAppeal.get(userId);
            if (guildId && guildId !== 'selecting') {
                const ban = db.prepare("SELECT * FROM bans WHERE userId = ? AND guildId = ? AND appealed = 0").get(userId, guildId) as any;
                if (!ban) {
                    awaitAppeal.delete(userId);
                    await message.reply({ content: "❌ Бан не найден или уже была подана апелляция." });
                    return;
                }

                // Сохраняем апелляцию
                db.prepare(`
                    UPDATE bans SET appealed = 1, appealText = ?, appealStatus = 'pending'
                    WHERE userId = ? AND guildId = ?
                `).run(message.content, userId, guildId);

                awaitAppeal.delete(userId);

                // Подтверждение пользователю
                await message.reply({ 
                    content: "✅ Ваша апелляция принята! Ожидайте ответа модераторов.\nВы получите уведомление в ЛС, когда она будет рассмотрена." 
                });

                // Пересылаем в канал логов
                await forwardAppealToChannel(client, guildId, message.author, message.content, ban);
                return;
            }
        }
    });
}

// ✅ Функция пересылки апелляции в канал
async function forwardAppealToChannel(
    client: Client,
    guildId: string,
    user: User,
    appealText: string,
    ban: any
) {
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const settings = db.prepare("SELECT logChannelId FROM guild_settings WHERE guildId = ?").get(guildId) as any;
    if (!settings?.logChannelId) return;

    const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null) as TextChannel | null;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle("📨 Новая апелляция")
        .setColor(0xFFA500)
        .addFields(
            { name: "👤 Пользователь", value: `<@${user.id}> (\`${user.id}\`)`, inline: true },
            { name: "📝 Причина бана", value: ban.reason, inline: false },
            { name: "⏱️ Длительность", value: ban.duration, inline: true },
            { name: "💬 Текст апелляции", value: appealText.length > 1000 ? appealText.slice(0, 1000) + "..." : appealText, inline: false }
        )
        .setFooter({ text: `ID: ${user.id}-${guildId}` })
        .setTimestamp();

    const components = [
        {
            type: 1,
            components: [
                { type: 2, style: 3, label: "✅ Одобрить", custom_id: `appeal_approve_${user.id}_${guildId}`, emoji: "✅" },
                { type: 2, style: 4, label: "❌ Отклонить", custom_id: `appeal_reject_${user.id}_${guildId}`, emoji: "❌" }
            ]
        }
    ] as any;

    await channel.send({ embeds: [embed], components }).catch(() => {});
}