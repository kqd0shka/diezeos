import { Guild, User, GuildMember, TextChannel, EmbedBuilder, Options } from "discord.js";
import { db } from "../database/database";
import { parseDuration, ParsedDuration, formatRemainingTime } from "../utils/timeParser";
import { parse } from "node:path";
import { sendLog } from "./logs.service";

export interface BanOptions {
    reason: string;
    duration: string;
    wipeStats: boolean;
    deleteMessageDays?: number;
}

export class BanService {

    static canBan(moderator: GuildMember, target: GuildMember): { can: boolean; reason?: string } {
        if (moderator.id === target.id) {
            return { can: false, reason: "❌ Вы не можете забанить самого себя." };
        }

        if (target.roles.highest.position >= moderator.roles.highest.position) {
            return { can: false, reason: "❌ Вы не можете забанить участника с равной или более высокой ролью." };
        }

        if (!moderator.permissions.has("BanMembers")) {
            return { can: false, reason: "❌ У вас нет прав на бан участников." };
        }
        return { can: true };
    }

    static parseBanDuration(input: string): { valid: boolean; parsed?: ParsedDuration; error?: string } {
        if (!input || input.trim() === '') {
            return { valid: false, error: "⏱️ Укажите длительность бана (например: `1d 2h 30m` или `0` для перманента)" };
        }

        const parsed = parseDuration(input);
        if (!parsed) {
            return { valid: false, error: "⏱️ Неверный формат длительности. Используйте комбинацию чисел и единиц (y, mo, w, d, h, m) или `0` для перманента." };
        }

        return { valid: true, parsed };
    }

// ✅ Применение бана
    static async applyBan(
        guild: Guild,
        target: User,
        moderator: GuildMember,
        options: BanOptions
    ): Promise<{ success: boolean; error?: string; banId?: string }> {
        
        // 1. Валидация длительности
        const durationCheck = this.parseBanDuration(options.duration);
        if (!durationCheck.valid) {
            return { success: false, error: durationCheck.error };
        }
        
        const parsed = durationCheck.parsed!;
        const expiresAt = parsed.isPermanent ? null : new Date(Date.now() + parsed.totalMs).toISOString();
        const banId = `${target.id}-${guild.id}-${Date.now()}`;

        try {
            // 2. Обнуление статистики (если запрошено)
            if (options.wipeStats) {
                db.prepare("DELETE FROM users WHERE userId = ? AND guildId = ?").run(target.id, guild.id);
                console.log(`🗑️ Статистика ${target.tag} обнулена`);
            }

            // 3. Сохранение бана в БД
            db.prepare(`
                INSERT INTO bans (
                    userId, guildId, moderatorId, reason, duration, expiresAt, 
                    wipeStats, appealed, appealStatus, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(userId, guildId) DO UPDATE SET
                    reason = excluded.reason,
                    duration = excluded.duration,
                    expiresAt = excluded.expiresAt,
                    wipeStats = excluded.wipeStats,
                    createdAt = excluded.createdAt
            `).run(
                target.id, guild.id, moderator.id, options.reason, options.duration,
                expiresAt, options.wipeStats ? 1 : 0, 0, 'pending', new Date().toISOString()
            );

            // 4. Сохранение в историю
            db.prepare(`
                INSERT INTO ban_history (
                    userId, guildId, moderatorId, reason, duration, wipedStats, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(
                target.id, guild.id, moderator.id, options.reason, options.duration,
                options.wipeStats ? 1 : 0, new Date().toISOString()
            );

            // 5. Реальный бан через Discord API
            const member = await guild.members.fetch(target.id).catch(() => null);
            if (member) {
                await member.ban({
                    reason: `🔨 ${moderator.user.tag}: ${options.reason}`,
                    deleteMessageSeconds: (options.deleteMessageDays || 0) * 86400
                }).catch(err => {
                    console.warn(`⚠️ Не удалось забанить ${target.tag} через API:`, err.message);
                    // Не прерываем, бан в БД уже применён
                });
            }

            

            // 6. Логирование
            await this.logBan(guild, target, moderator, options, parsed, expiresAt);

            return { success: true, banId };

        } catch (error: any) {
            console.error("❌ Ошибка применения бана:", error);
            return { success: false, error: `❌ Ошибка: ${error.message}` };
        }
    }

    // ✅ Логирование бана в канал
    private static async logBan(
        guild: Guild,
        target: User,
        moderator: GuildMember,
        options: BanOptions,
        parsed: ParsedDuration,
        expiresAt: string | null
    ) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle("🔨 Пользователь забанен")
            .addFields(
                { name: "👤 Пользователь", value: `<@${target.id}> (\`${target.id}\`)`, inline: true },
                { name: "👮 Модератор", value: `<@${moderator.id}>`, inline: true },
                { name: "📝 Причина", value: options.reason, inline: false },
                { name: "⏱️ Длительность", value: parsed.humanReadable, inline: true },
                { name: "🔓 Разбан", value: expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : "Никогда", inline: true },
                { name: "🗑️ Статистика", value: options.wipeStats ? "❌ Обнулена" : "✅ Сохранена", inline: true }
            )
            .setFooter({ text: `ID: ${target.id}-${guild.id}-${Date.now()}` })
            .setTimestamp();

        await sendLog(guild, embed).catch(() => {});
    }

    // ✅ Проверка истёкших банов (с отладкой)
static async checkExpiredBans(client: any) {
    const now = new Date().toISOString();

    // Получаем ВСЕ баны с expiresAt
    const allBans = db.prepare(`
        SELECT userId, guildId, expiresAt, appealed, reason
        FROM bans 
        WHERE expiresAt IS NOT NULL
    `).all() as Array<{ userId: string; guildId: string; expiresAt: string; appealed: string }>;
    
    
    if (allBans.length > 0) {
        allBans.forEach(ban => {
            const isExpired = new Date(ban.expiresAt) <= new Date();
            console.log(`   - ${ban.userId} на ${ban.guildId}, истекает: ${ban.expiresAt}, истёк: ${isExpired}, апелляция: ${ban.appealed}`);
        });
    }
    
    
    // Получаем только ИСТЁКШИЕ баны
    const expired = db.prepare(`
        SELECT userId, guildId, expiresAt, reason
        FROM bans 
        WHERE expiresAt IS NOT NULL 
        AND expiresAt <= ?
        AND appealed != 'approved'
    `).all(now) as Array<{ userId: string; guildId: string; expiresAt: string; reason: string }>;


    if (expired.length === 0) {
        return;
    }

    for (const ban of expired) {
        try {

            const guild = await client.guilds.fetch(ban.guildId).catch((err: any) => {
                return null;
            });
            
            if (!guild) {
                db.prepare("DELETE FROM bans WHERE userId = ? AND guildId = ?").run(ban.userId, ban.guildId);
                continue;
            }

            // Проверяем, есть ли бан в Discord
            const discordBan = await guild.bans.fetch(ban.userId).catch(() => null);
            if (!discordBan) {
                db.prepare("DELETE FROM bans WHERE userId = ? AND guildId = ?").run(ban.userId, ban.guildId);
                continue;
            }

            // Удаляем из БД
            db.prepare("DELETE FROM bans WHERE userId = ? AND guildId = ?").run(ban.userId, ban.guildId);

            // Разбаниваем через Discord API
            await guild.bans.remove(ban.userId, "⏰ Истёк срок бана");
            // ✅ УВЕДОМЛЕНИЕ ПОЛЬЗОВАТЕЛЮ О РАЗБАНЕ
            try {
                const user = await client.users.fetch(ban.userId).catch(() => null);
                if (user) {
                    const embed = new EmbedBuilder()
                        .setColor(0x22c55e)
                        .setTitle("✅ Ваш бан истёк")
                        .setDescription(`Вы были разбанены на сервере **${guild.name}**`)
                        .addFields(
                            { name: "📝 Причина бана", value: ban.reason || "Не указана", inline: false },
                            { name: "🔓 Статус", value: "**Разбанен**", inline: true }
                        )
                        .setFooter({ text: "Теперь вы можете вернуться на сервер" })
                        .setTimestamp();
                    
                    await user.send({ embeds: [embed] });

                }
            } catch (err: any) {

            }
            
            // Логирование в канал
            try {
                const logChannel = db.prepare("SELECT logChannelId FROM guild_settings WHERE guildId = ?").get(ban.guildId) as any;
                if (logChannel?.logChannelId) {
                    const channel = await guild.channels.fetch(logChannel.logChannelId).catch(() => null);
                    if (channel && channel.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setColor(0x22c55e)
                            .setTitle("⏰ Автоматический разбан")
                            .setDescription(`Пользователь <@${ban.userId}> был разбанен автоматически (срок бана истёк)`)
                            .addFields(
                                { name: "👤 ID пользователя", value: ban.userId, inline: true },
                                { name: "📅 Истёк", value: ban.expiresAt, inline: true }
                            )
                            .setTimestamp();
                        await channel.send({ embeds: [embed] });
                    }
                }
            } catch (logErr) {
                console.warn(`⚠️ [AUTO-UNBAN] Не удалось отправить лог:`, logErr);
            }
            
        } catch (error) {
            console.error(`❌ [AUTO-UNBAN] Критическая ошибка при разбане ${ban.userId}:`, error);
        }
    }
}

    // ✅ Подача апелляции
    static async submitAppeal(userId: string, guildId: string, appealText: string): Promise<{ success: boolean; error?: string }> {
        const ban = db.prepare("SELECT * FROM bans WHERE userId = ? AND guildId = ?").get(userId, guildId) as any;
        
        if (!ban) {
            return { success: false, error: "❌ У вас нет активного бана на этом сервере" };
        }

        if (ban.appealed) {
            return { success: false, error: "❌ Вы уже подавали апелляцию. Ожидайте ответа." };
        }

        db.prepare(`
            UPDATE bans SET appealed = 1, appealText = ?, appealStatus = 'pending'
            WHERE userId = ? AND guildId = ?
        `).run(appealText, userId, guildId);

        return { success: true };
    }

    // ✅ Получение активного бана пользователя
    static getActiveBan(userId: string, guildId: string) {
        return db.prepare(`
            SELECT *, 
                   CASE WHEN expiresAt IS NOT NULL THEN 
                       (julianday(expiresAt) - julianday('now')) * 24 * 60 
                   END as minutesRemaining
            FROM bans WHERE userId = ? AND guildId = ?
        `).get(userId, guildId) as any;
    }
}