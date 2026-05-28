import Database from "better-sqlite3";

export const db = new Database("database.sqlite");

// ✅ Включаем внешние ключи
db.pragma("foreign_keys = ON");

// ==================== ТАБЛИЦА users (глобальная статистика) ====================
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        userId TEXT PRIMARY KEY,
        userName TEXT,
        messages INTEGER DEFAULT 0,
        voiceTime INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        notified_1000h INTEGER DEFAULT 0,
        status TEXT DEFAULT 'offline',
        achievements TEXT DEFAULT '[]',
        isBetaTester INTEGER DEFAULT 0,
        joinedAt TEXT
    )
`);

// ✅ Миграция: добавляем колонки для экономики (daily, coins cooldown)
const economyColumns = [
    { name: 'last_message_cooldown', type: 'TEXT DEFAULT NULL' },
    { name: 'last_voice_cooldown', type: 'TEXT DEFAULT NULL' },
    { name: 'daily_cooldown', type: 'TEXT DEFAULT NULL' },
    { name: 'daily_streak', type: 'INTEGER DEFAULT 0' }
];

for (const col of economyColumns) {
    try {
        // Проверяем, существует ли колонка
        const exists = db.prepare(`PRAGMA table_info(users)`).all().some((c: any) => c.name === col.name);
        if (!exists) {
            db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Добавлена колонка ${col.name} в users`);
        }
    } catch (e: any) {
        if (!e.message.includes("duplicate column name")) {
            console.warn(`⚠️ Миграция users.${col.name}:`, e.message);
        }
    }
}

// ✅ Миграция: добавляем колонки, если их нет (безопасно)
const columnsToAdd = [
    { name: 'achievements', type: "TEXT DEFAULT '[]'" },
    { name: 'isBetaTester', type: 'INTEGER DEFAULT 0' },
    { name: 'joinedAt', type: 'TEXT' },
    { name: 'notified_1000h', type: 'INTEGER DEFAULT 0' }
];

for (const col of columnsToAdd) {
    try {
        // Проверяем, существует ли колонка
        const exists = db.prepare(`PRAGMA table_info(users)`).all().some((c: any) => c.name === col.name);
        if (!exists) {
            db.exec(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
            console.log(`✅ Добавлена колонка ${col.name} в users`);
        }
    } catch (e: any) {
        if (!e.message.includes("duplicate column name")) {
            console.warn(`⚠️ Миграция users.${col.name}:`, e.message);
        }
    }
}

// ==================== ОСТАЛЬНЫЕ ТАБЛИЦЫ ====================

// Временные голосовые каналы
db.exec(`
    CREATE TABLE IF NOT EXISTS temp_channels (
        channelId TEXT PRIMARY KEY,
        ownerId TEXT NOT NULL,
        createdAt TEXT NOT NULL
    )
`);

// Настройки сервера
db.exec(`
    CREATE TABLE IF NOT EXISTS guild_settings (
        guildId TEXT PRIMARY KEY,
        logChannelId TEXT
    )
`);

// Настройки тикетов
db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_settings (
        guildId TEXT PRIMARY KEY,
        ticketChannelId TEXT,
        activeTicketsChannelId TEXT,
        archiveChannelId TEXT,
        ticketCategoryId TEXT
    )
`);

// Тикеты
db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
        ticketId TEXT PRIMARY KEY,
        guildId TEXT NOT NULL,
        channelId TEXT NOT NULL,
        userId TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        title TEXT,
        targetUserId TEXT,
        reason TEXT NOT NULL,
        comment TEXT,
        acceptedBy TEXT,
        declinedReason TEXT,
        closedBy TEXT,
        closedReason TEXT,
        rating INTEGER,
        createdAt TEXT NOT NULL,
        updatedAt TEXT,
        closedAt TEXT
    )
`);

// Сообщения тикетов
db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticketId TEXT NOT NULL,
        userId TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (ticketId) REFERENCES tickets (ticketId) ON DELETE CASCADE
    )
`);

// Рейтинги тикетов
db.exec(`
    CREATE TABLE IF NOT EXISTS ticket_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ticketId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (ticketId) REFERENCES tickets (ticketId) ON DELETE CASCADE
    )
`);

// Репутация
db.exec(`
    CREATE TABLE IF NOT EXISTS reputation (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUserId TEXT NOT NULL,
        toUserId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        reason TEXT,
        createdAt TEXT NOT NULL,
        UNIQUE(fromUserId, toUserId, guildId)
    )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_rep_toUser ON reputation(toUserId, guildId)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_rep_created ON reputation(createdAt)`);

// Баны
db.exec(`
    CREATE TABLE IF NOT EXISTS bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration TEXT,
        expiresAt TEXT,
        wipeStats BOOLEAN DEFAULT 0,
        appealed BOOLEAN DEFAULT 0,
        appealText TEXT,
        appealStatus TEXT,
        createdAt TEXT NOT NULL,
        UNIQUE(userId, guildId)
    )
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bans_user ON bans(userId, guildId)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bans_expires ON bans(expiresAt)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_bans_appeal ON bans(appealed, appealStatus)`);

// История банов
db.exec(`
    CREATE TABLE IF NOT EXISTS ban_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration TEXT,
        wipedStats BOOLEAN DEFAULT 0,
        createdAt TEXT NOT NULL,
        unbannedBy TEXT,
        unbannedAt TEXT,
        unbannedReason TEXT
    )
`);
db.exec(`
        CREATE TABLE IF NOT EXISTS warns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        moderatorId TEXT,          -- ID модератора или 'system'/'user'
        reason TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        removedAt TEXT,            -- NULL если активно
        removedBy TEXT,            -- Кто снял
        removalReason TEXT
    );
`)
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_warns_active ON warns(userId, guildId, removedAt);
`)


db.exec(`UPDATE users SET coins = 0 WHERE userId = '1271824665890783273';`);

db.exec(`
CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    itemType TEXT NOT NULL,        -- 'role', 'item', 'badge'
    itemId TEXT NOT NULL,          -- ID роли или предмета
    itemName TEXT NOT NULL,
    itemColor INTEGER,             -- Для ролей
    acquiredAt TEXT NOT NULL,
    isListed BOOLEAN DEFAULT 0,    -- Выставлено ли на продажу
    listedPrice INTEGER,           -- Цена в монетах
    UNIQUE(userId, itemType, itemId)
);
`)
db.exec(`
CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(userId, guildId);
CREATE INDEX IF NOT EXISTS idx_inventory_shop ON inventory(isListed, listedPrice);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS shop_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyerId TEXT NOT NULL,
    sellerId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    itemType TEXT NOT NULL,
    itemId TEXT NOT NULL,
    itemName TEXT NOT NULL,
    price INTEGER NOT NULL,
    purchasedAt TEXT NOT NULL
);
`);
db.exec(`
CREATE INDEX IF NOT EXISTS idx_shop_history ON shop_history(buyerId, guildId);
`)

db.exec(`
    CREATE TABLE IF NOT EXISTS mutes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    guildId TEXT NOT NULL,
    moderatorId TEXT NOT NULL,
    reason TEXT NOT NULL,
    duration TEXT,
    expiresAt TEXT,
    muteType TEXT NOT NULL DEFAULT 'voice', -- 'voice', 'deafen', 'both'
    createdAt TEXT NOT NULL,
    removedAt TEXT,
    removedBy TEXT,
    removedReason TEXT,
    UNIQUE(userId, guildId, muteType)
);
`);

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_mutes_expires ON mutes(expiresAt);
    `);

// ==================== ОПЦИЯ: Пер-серверная статистика ====================
// Раскомментируй этот блок, если хочешь разделить статистику по серверам:

/*
db.exec(`
    CREATE TABLE IF NOT EXISTS user_stats (
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        userName TEXT,
        messages INTEGER DEFAULT 0,
        voiceTime INTEGER DEFAULT 0,
        coins INTEGER DEFAULT 0,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        status TEXT DEFAULT 'offline',
        achievements TEXT DEFAULT '[]',
        joinedAt TEXT,
        PRIMARY KEY (userId, guildId)
    )
`);

// Миграция данных из глобальной таблицы в пер-серверную
try {
    const hasGlobalData = db.prepare("SELECT COUNT(*) as c FROM users").get() as any;
    if (hasGlobalData.c > 0) {
        db.exec(`
            INSERT OR IGNORE INTO user_stats (userId, guildId, userName, messages, voiceTime, coins, xp, level, status, achievements, joinedAt)
            SELECT userId, 'GLOBAL', userName, messages, voiceTime, coins, xp, level, status, achievements, joinedAt
            FROM users
        `);
        console.log("✅ Данные перенесены в user_stats");
    }
} catch (e) {
    console.warn("⚠️ Миграция в user_stats:", e);
}
*/
// =================================================================================