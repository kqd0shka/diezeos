import { Guild, User, GuildMember, EmbedBuilder, Client } from "discord.js";
import { db } from "../database/database";
import { sendLog } from "./logs.service";

export class WarnService {
    // ✅ Получение количества активных варнов
    static getActiveCount(userId: string, guildId: string): number {
        const row = db.prepare(`
            SELECT COUNT(*) as count FROM warns 
            WHERE userId = ? AND guildId = ? AND removedAt IS NULL
        `).get(userId, guildId) as { count: number } | undefined;
        return row?.count ?? 0;
    }

    // ✅ Получение списка активных варнов
    static getActiveWarns(userId: string, guildId: string) {
        return db.prepare(`
            SELECT * FROM warns 
            WHERE userId = ? AND guildId = ? AND removedAt IS NULL 
            ORDER BY createdAt DESC
        `).all(userId, guildId) as any[];
    }

    // ✅ Выдача варна
    static async addWarn(guild: Guild, target: User, moderator: GuildMember, reason: string, client: Client) {
        const count = this.getActiveCount(target.id, guild.id);
        if (count >= 3) return { success: false, error: "❌ У пользователя уже 3 активных предупреждения." };

        db.prepare(`
            INSERT INTO warns (userId, guildId, moderatorId, reason, createdAt)
            VALUES (?, ?, ?, ?, ?)
        `).run(target.id, guild.id, moderator.id, reason, new Date().toISOString());

        const newCount = count + 1;

        // 🔨 Авто-бан при 3 варнах
        if (newCount === 3) {
            try {
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

                    // ✅ ОТПРАВКА ЛС ПОЛЬЗОВАТЕЛЮ
                    try {
                        const embed = new EmbedBuilder()
                            .setColor(0xFF0000)
                            .setTitle("🔨 Вы получили бан")
                            .setDescription(`Вы были забанены на сервере **${guild.name}**`)
                            .addFields(
                                { name: "📝 Причина", value: "Автоматический бан за 3 предупреждения", inline: false },
                                { name: "⏱️ Длительность", value: "1 день", inline: true },
                                { name: "🔓 Разбан", value: "Автоматически через 24 часа", inline: true }
                            )
                            .setTimestamp();
                        
                        await target.send({ embeds: [embed] });
                        
                    } catch (err: any) {
                        // Discord error codes:
                        // 50007 = Cannot send messages to this user (ЛС закрыты)
                        // 50001 = Missing Access (нет прав)
                        // другие = таймаут, сеть, и т.д.
                    }

                await guild.bans.create(target.id, { 
                    reason: `🔨 Авто-бан: 3 предупреждения`, 
                    deleteMessageSeconds: 0 
                });
                
                // Дублируем в таблицу bans для работы авто-разбана
                db.prepare(`
                    INSERT INTO bans (
                        userId, guildId, moderatorId, reason, duration, expiresAt, 
                        wipeStats, appealed, appealStatus, createdAt
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(userId, guildId) DO UPDATE SET
                        reason = excluded.reason,
                        duration = excluded.duration,
                        expiresAt = excluded.expiresAt,
                        appealed = excluded.appealed,
                        appealStatus = excluded.appealStatus,
                        createdAt = excluded.createdAt
                `).run(
                    target.id, guild.id, 'system', 
                    "Автоматический бан за 3 предупреждения", 
                    "1d", expiresAt, 0, 0, 'pending', new Date().toISOString()
                );

                        // ✅ === НОВОЕ: СБРОС ВАРНОВ ПОСЛЕ БАНА ===
                db.prepare(`
                    UPDATE warns SET removedAt = ?, removedBy = ?, removalReason = ?
                    WHERE userId = ? AND guildId = ? AND removedAt IS NULL
                `).run(
                    new Date().toISOString(), 
                    'system', 
                    'Автоматически сброшено после бана', 
                    target.id, 
                    guild.id
                );

            } catch (err) {
                
            }
        }

        // 📜 Лог
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle("⚠️ Пользователь получил предупреждение")
            .addFields(
                { name: "👤 Пользователь", value: `<@${target.id}>`, inline: true },
                { name: "👮 Модератор", value: `<@${moderator.id}>`, inline: true },
                { name: "📝 Причина", value: reason, inline: false },
                { name: "📊 Предупреждений", value: `${newCount}/3`, inline: true }
            )
            .setTimestamp();
        await sendLog(guild, embed).catch(() => {});

        return { success: true, count: newCount };
    }

    // ✅ Снятие варна модератором
    static async removeWarnByMod(guild: Guild, target: User, moderator: GuildMember, reason?: string) {
        const active = this.getActiveWarns(target.id, guild.id);
        if (active.length === 0) return { success: false, error: "❌ У пользователя нет активных предупреждений." };

        const latest = active[0];
        db.prepare(`
            UPDATE warns SET removedAt = ?, removedBy = ?, removalReason = ?
            WHERE id = ?
        `).run(new Date().toISOString(), moderator.id, reason || "Снято модератором", latest.id);

        const embed = new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("✅ Предупреждение снято")
            .addFields(
                { name: "👤 Пользователь", value: `<@${target.id}>`, inline: true },
                { name: " Модератор", value: `<@${moderator.id}>`, inline: true },
                { name: "📝 Причина снятия", value: reason || "Не указана", inline: false }
            )
            .setTimestamp();
        await sendLog(guild, embed).catch(() => {});

        return { success: true, remaining: active.length - 1 };
    }

    // ✅ Снятие варна пользователем за монеты
    static async removeWarnByUser(guild: Guild, target: User, reason?: string) {
        const active = this.getActiveWarns(target.id, guild.id);
        if (active.length === 0) return { success: false, error: "❌ У вас нет активных предупреждений." };

        const user = db.prepare("SELECT coins FROM users WHERE userId = ?").get(target.id) as any;
        const currentCoins = user?.coins || 0;
        const COST = 10000;

        if (currentCoins < COST) {
            return { success: false, error: `❌ Недостаточно монет. Нужно ${COST}, у вас ${currentCoins}.` };
        }

        const latest = active[0];
        db.prepare(`
            UPDATE warns SET removedAt = ?, removedBy = ?, removalReason = ?
            WHERE id = ?
        `).run(new Date().toISOString(), target.id, reason || "Снято за монеты", latest.id);

        // Списываем монеты
        db.prepare("UPDATE users SET coins = coins - ? WHERE userId = ?").run(COST, target.id);

        const embed = new EmbedBuilder()
            .setColor(0x22c55e)
            .setTitle("✅ Предупреждение снято за монеты")
            .addFields(
                { name: " Пользователь", value: `<@${target.id}>`, inline: true },
                { name: "💰 Списано", value: `${COST} монет`, inline: true },
                { name: "📝 Причина", value: reason || "Не указана", inline: false }
            )
            .setTimestamp();
        await sendLog(guild, embed).catch(() => {});

        return { success: true, remaining: active.length - 1, cost: COST };
    }
}