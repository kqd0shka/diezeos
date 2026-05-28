import { Client, Message } from "discord.js";
import { db } from "../database/database";

export function setupMessageCoins(client: Client) {
    client.on("messageCreate", async (message: Message) => {
        // Игнорируем ботов, ЛС и системные сообщения
        if (message.author.bot || !message.guild || message.system) return;

        const userId = message.author.id;
        const now = Date.now();
        const COOLDOWN_MS = 60 * 1000; // 1 минута

        // Проверяем кулдаун
        const user = db.prepare("SELECT last_message_cooldown FROM users WHERE userId = ?").get(userId) as any;
        if (user?.last_message_cooldown) {
            const lastMsg = new Date(user.last_message_cooldown).getTime();
            if (now - lastMsg < COOLDOWN_MS) return; // Кулдаун ещё активен
        }

        // ✅ Начисляем 2 коина + обновляем статистику
        db.prepare(`
            INSERT INTO users (userId, coins, messages, last_message_cooldown)
            VALUES (?, 2, 1, ?)
            ON CONFLICT(userId) DO UPDATE SET
                coins = COALESCE(coins, 0) + 2,
                messages = COALESCE(messages, 0) + 1,
                last_message_cooldown = excluded.last_message_cooldown
        `).run(userId, new Date(now).toISOString());
    });
}