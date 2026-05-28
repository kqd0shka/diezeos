import { db } from "../database/database";
import { User, Guild } from "discord.js";

export interface RepStats {
    received: number;    // Сколько получил
    given: number;       // Сколько отдал
    lastReceived: string | null;
}

export class ReputationService {
    
    // ✅ Проверка: можно ли дать репутацию
    static async canGiveRep(fromUserId: string, toUserId: string, guildId: string): Promise<{
        can: boolean;
        reason?: string;
        nextAvailable?: Date;
    }> {
        if (fromUserId === toUserId) {
            return { can: false, reason: "❌ Нельзя дать репутацию самому себе" };
        }

        const existing = db.prepare(`
            SELECT createdAt FROM reputation 
            WHERE fromUserId = ? AND toUserId = ? AND guildId = ?
        `).get(fromUserId, toUserId, guildId) as { createdAt: string } | undefined;

        if (existing) {
            const lastGiven = new Date(existing.createdAt);
            const nextAvailable = new Date(lastGiven.getTime() + 24 * 60 * 60 * 1000); // +24 часа
            
            if (new Date() < nextAvailable) {
                return {
                    can: false,
                    reason: `⏳ Вы уже дали репутацию этому пользователю. Следующая доступна <t:${Math.floor(nextAvailable.getTime() / 1000)}:R>`,
                    nextAvailable
                };
            }
        }

        return { can: true };
    }

    // ✅ Дать репутацию
    static async giveRep(fromUser: User, toUser: User, guild: Guild, reason?: string) {
        const check = await this.canGiveRep(fromUser.id, toUser.id, guild.id);
        if (!check.can) {
            throw new Error(check.reason);
        }

        // Обновляем старую запись или создаём новую
        db.prepare(`
            INSERT INTO reputation (fromUserId, toUserId, guildId, reason, createdAt)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(fromUserId, toUserId, guildId) 
            DO UPDATE SET createdAt = excluded.createdAt, reason = excluded.reason
        `).run(fromUser.id, toUser.id, guild.id, reason || null, new Date().toISOString());

        return true;
    }

    // ✅ Получить статистику пользователя
    static getStats(userId: string, guildId: string): RepStats {
        const stats = db.prepare(`
            SELECT 
                (SELECT COUNT(*) FROM reputation WHERE toUserId = ? AND guildId = ?) as received,
                (SELECT COUNT(*) FROM reputation WHERE fromUserId = ? AND guildId = ?) as given,
                (SELECT createdAt FROM reputation WHERE toUserId = ? AND guildId = ? ORDER BY createdAt DESC LIMIT 1) as lastReceived
        `).get(userId, guildId, userId, guildId, userId, guildId) as RepStats;

        return stats || { received: 0, given: 0, lastReceived: null };
    }

    // ✅ Топ пользователей по репутации
    static getTopRep(guildId: string, limit: number = 10) {
        return db.prepare(`
            SELECT 
                toUserId,
                COUNT(*) as repCount,
                MAX(createdAt) as lastRep
            FROM reputation
            WHERE guildId = ?
            GROUP BY toUserId
            ORDER BY repCount DESC, lastRep DESC
            LIMIT ?
        `).all(guildId, limit) as Array<{ toUserId: string; repCount: number; lastRep: string }>;
    }
}