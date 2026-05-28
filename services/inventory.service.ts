import { Guild, GuildMember, Role, EmbedBuilder } from "discord.js";
import { db } from "../database/database";
import { sendLog } from "./logs.service";

export class InventoryService {
    // ✅ Добавление предмета в инвентарь
    static async addItem(
        userId: string,
        guildId: string,
        itemType: 'role' | 'item' | 'badge',
        itemId: string,
        itemName: string,
        itemColor?: number
    ): Promise<boolean> {
        try {
            db.prepare(`
                INSERT INTO inventory (userId, guildId, itemType, itemId, itemName, itemColor, acquiredAt)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(userId, itemType, itemId) DO UPDATE SET
                    itemName = excluded.itemName,
                    itemColor = excluded.itemColor,
                    acquiredAt = excluded.acquiredAt
            `).run(userId, guildId, itemType, itemId, itemName, itemColor ?? null, new Date().toISOString());
            return true;
        } catch (err) {
            console.error("❌ Ошибка добавления в инвентарь:", err);
            return false;
        }
    }

    // ✅ Получение инвентаря пользователя
    static getInventory(userId: string, guildId: string) {
        return db.prepare(`
            SELECT * FROM inventory 
            WHERE userId = ? AND guildId = ? 
            ORDER BY acquiredAt DESC
        `).all(userId, guildId) as any[];
    }

    // ✅ Выставление предмета на продажу
    static async listForSale(
        userId: string,
        guildId: string,
        itemType: string,
        itemId: string,
        price: number
    ): Promise<{ success: boolean; error?: string }> {
        
        if (price < 500) {
            return { success: false, error: "❌ Минимальная цена: 500 монет" };
        }

        const item = db.prepare(`
            SELECT * FROM inventory 
            WHERE userId = ? AND guildId = ? AND itemType = ? AND itemId = ?
        `).get(userId, guildId, itemType, itemId) as any;

        if (!item) {
            return { success: false, error: "❌ Предмет не найден в инвентаре" };
        }

        if (item.isListed) {
            return { success: false, error: "❌ Этот предмет уже выставлен на продажу" };
        }

        try {
            db.prepare(`
                UPDATE inventory SET isListed = 1, listedPrice = ?
                WHERE userId = ? AND guildId = ? AND itemType = ? AND itemId = ?
            `).run(price, userId, guildId, itemType, itemId);

            return { success: true };
        } catch (err) {
            return { success: false, error: "❌ Ошибка при выставлении на продажу" };
        }
    }

    // ✅ Снятие с продажи
    static async unlistItem(
        userId: string,
        guildId: string,
        itemType: string,
        itemId: string
    ): Promise<boolean> {
        try {
            db.prepare(`
                UPDATE inventory SET isListed = 0, listedPrice = NULL
                WHERE userId = ? AND guildId = ? AND itemType = ? AND itemId = ?
            `).run(userId, guildId, itemType, itemId);
            return true;
        } catch {
            return false;
        }
    }

    // ✅ Покупка предмета
    static async purchaseItem(
        buyerId: string,
        sellerId: string,
        guildId: string,
        itemType: string,
        itemId: string,
        price: number
    ): Promise<{ success: boolean; error?: string; itemName?: string }> {
        
        const item = db.prepare(`
            SELECT * FROM inventory 
            WHERE userId = ? AND guildId = ? AND itemType = ? AND itemId = ? AND isListed = 1
        `).get(sellerId, guildId, itemType, itemId) as any;

        if (!item) {
            return { success: false, error: "❌ Предмет больше не доступен для покупки" };
        }

        // Проверяем баланс покупателя
        const buyer = db.prepare("SELECT coins FROM users WHERE userId = ?").get(buyerId) as any;
        if ((buyer?.coins || 0) < price) {
            return { success: false, error: `❌ Недостаточно монет. Нужно ${price}` };
        }

        try {
            // Транзакция: списываем → начисляем → передаём предмет → логируем
            db.transaction(() => {
                // 1. Списываем у покупателя
                db.prepare("UPDATE users SET coins = coins - ? WHERE userId = ?").run(price, buyerId);
                
                // 2. Начисляем продавцу (90% — комиссия сервера 10%)
                const sellerEarnings = Math.floor(price * 0.9);
                db.prepare("UPDATE users SET coins = coins + ? WHERE userId = ?").run(sellerEarnings, sellerId);
                
                // 3. Передаём предмет
                db.prepare(`
                    UPDATE inventory SET userId = ?, isListed = 0, listedPrice = NULL, acquiredAt = ?
                    WHERE userId = ? AND guildId = ? AND itemType = ? AND itemId = ?
                `).run(buyerId, new Date().toISOString(), sellerId, guildId, itemType, itemId);
                
                // 4. Записываем в историю
                db.prepare(`
                    INSERT INTO shop_history (buyerId, sellerId, guildId, itemType, itemId, itemName, price, purchasedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `).run(buyerId, sellerId, guildId, itemType, itemId, item.itemName, price, new Date().toISOString());
            })();

            return { success: true, itemName: item.itemName };
        } catch (err: any) {
            console.error("❌ Ошибка покупки:", err);
            return { success: false, error: `❌ Ошибка транзакции: ${err.message}` };
        }
    }

    // ✅ Получение товаров из магазина
    static getShopItems(guildId: string, limit: number = 25) {
        return db.prepare(`
            SELECT i.*, u.userName as sellerName
            FROM inventory i
            LEFT JOIN users u ON i.userId = u.userId
            WHERE i.guildId = ? AND i.isListed = 1
            ORDER BY i.listedPrice ASC
            LIMIT ?
        `).all(guildId, limit) as any[];
    }

    // ✅ Исправленный метод (только проверка, без удаления)
    static async checkRoleExists(guild: Guild, roleId: string): Promise<boolean> {
        const role = await guild.roles.fetch(roleId).catch(() => null);
        return !!role;
    }
}