import { Client, VoiceState } from "discord.js";
import { db } from "../database/database";

// Храним время входа в войс для каждого пользователя
const voiceJoinTimes = new Map<string, number>();

export function setupVoiceCoins(client: Client) {
    client.on("voiceStateUpdate", async (oldState: VoiceState, newState: VoiceState) => {
        if (newState.member?.user.bot) return;
        const userId = newState.id;

        //  Пользователь зашёл в войс
        if (!oldState.channelId && newState.channelId) {
            voiceJoinTimes.set(userId, Date.now());
            return;
        }

        // 🔴 Пользователь вышел или перешёл в другой канал
        if (oldState.channelId) {
            const joinTime = voiceJoinTimes.get(userId);
            if (!joinTime) return;

            const durationMs = Date.now() - joinTime;
            const fullMinutes = Math.floor(durationMs / 60000); // Считаем только полные минуты
            
            if (fullMinutes > 0) {
                const now = Date.now();
                const coinsToAdd = fullMinutes * 2;
                const voiceSeconds = Math.floor(durationMs / 1000);

                // ✅ Начисляем монеты + обновляем время в войсе
                db.prepare(`
                    INSERT INTO users (userId, coins, voiceTime, last_voice_cooldown)
                    VALUES (?, ?, ?, ?)
                    ON CONFLICT(userId) DO UPDATE SET
                        coins = COALESCE(coins, 0) + ?,
                        voiceTime = COALESCE(voiceTime, 0) + ?,
                        last_voice_cooldown = excluded.last_voice_cooldown
                `).run(userId, coinsToAdd, voiceSeconds, new Date(now).toISOString(), coinsToAdd, voiceSeconds);
            }

            voiceJoinTimes.delete(userId); // Очищаем таймер
        }
    });
}