// КОНСОЛЬ
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

function getTimestamp(): string {
    return new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Перехватываем console.log
console.log = (...args: any[]) => {
    originalLog(`[${getTimestamp()}]`, ...args);
};

// Перехватываем console.warn
console.warn = (...args: any[]) => {
    originalWarn(`[${getTimestamp()}] ⚠️`, ...args);
};

// Перехватываем console.error
console.error = (...args: any[]) => {
    originalError(`[${getTimestamp()}] ❌`, ...args);
};
// КОНСОЛЬ


import { Client, Guild, GuildMember, EmbedBuilder, userMention, GatewayIntentBits, Partials } from "discord.js";
import { TICKET_CATEGORIES } from './config';  // ✅ Работает через index.ts
import { DeployCommands } from "./deploy-commands";
import { commands } from "./commands";
import { addVoiceTime } from "./services/stats.service";
import { db } from "./database/database"
import { giveVoiceRoles } from "./events/giveRoles";
import { handleVoiceStateUpdate } from "./events/voice_handler";
import { loadTemplateChannelsCache } from "./services/voice_room.service";
import { setupLogging } from "./events/logs";
import { handleTicketModal } from "./events/ticket_modal";
import { daily } from "./commands/daily";
import { setupVoiceCoins } from "./events/voiceCoin";
import { ban } from "./commands/ban";
import { unban } from "./commands/unBan";
import { BanService } from "./services/ban.service";
import { setupAppealHandler } from "./events/appealHandler";
import { WarnService } from "./services/warn.service";
import { warn } from "./commands/warn";
import { unwarn } from "./commands/unwarn";
import { paywarn } from "./commands/removewarn";
import { appeal } from "./commands/appeal";
import { createrole } from "./commands/createrole";
import { inventory } from "./commands/inventory";
import { sellrole } from "./commands/sellrole";
import { shop } from "./commands/shop";
import { buyrole } from "./commands/buyrole";
import { InventoryService } from "./services/inventory.service";
import { handleSellRoleSelect } from "./events/handleSellRoleSelect";
import { handleSellRoleModal } from "./events/handleSellRoleModal";
import { givecoin } from "./commands/givecoin";
import { transfer } from "./commands/transfer";
import { infoembeds } from "./commands/infoembeds";
import { mute } from "./commands/mute";
import { unmute } from "./commands/unmute";

// бот получает информацию о событиях на сервере, сообщения на серевере и в личных сообщениях
const client = new Client({
    intents: [ 
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User
    ]
});

// 🔹 За пределами client.on() — создаём хранилище
const processedInteractions = new Set<string>();

client.on("interactionCreate", async (interaction) => {
    
    setTimeout(() => processedInteractions.delete(interaction.id), 10000);

    // ✅ Обработка select menu
    if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
        await handleTicketModal(interaction);
        return;
    }

    // Обработка select menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'sell_role_select') {
        await handleSellRoleSelect(interaction);
        return;
    }

    // Обработка модалки продажи
    if (interaction.isModalSubmit() && interaction.customId.startsWith('sell_role_modal_')) {
        await handleSellRoleModal(interaction);
        return;
    }
    
    // ✅ Обработка кнопок
    if (interaction.isButton() && interaction.customId.startsWith("ticket_")) {
        await handleTicketModal(interaction);
        return;
    }
    
    // ✅ Обработка модалок
    if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_")) {
        await handleTicketModal(interaction);
        return;
    }
    
    
    if (!interaction.isChatInputCommand()) return;
    
    if (processedInteractions.has(interaction.id)) return;
    processedInteractions.add(interaction.id);
    
    console.log("⚡ [COMMAND] Команда:", interaction.commandName);
    
    const command = commands[interaction.commandName as keyof typeof commands];

        // В обработчике interactionCreate:
    if (interaction.commandName === "daily") {
        await daily.execute(interaction);
        return;
    }

        // Обработчик команд
    if (interaction.commandName === "ban") {
        await ban.execute(interaction);
        return;
    }
    if (interaction.commandName === "appeal") {
    await appeal.execute(interaction);
    return;
}
    if (interaction.commandName === "unban") {
        await unban.execute(interaction);
        return;
    }
    if (interaction.commandName === "createrole") { await createrole.execute(interaction); return; }
    if (interaction.commandName === "inventory") { await inventory.execute(interaction); return; }
    if (interaction.commandName === "sellrole") { await sellrole.execute(interaction); return; }
    if (interaction.commandName === "shop") { await shop.execute(interaction); return; }
    if (interaction.commandName === "buyrole") { await buyrole.execute(interaction); return; }

    if (interaction.commandName === "givecoin") { await givecoin.execute(interaction); return; }
    if (interaction.commandName === "transfer") { await transfer.execute(interaction); return; }
    
    // if (interaction.commandName === "info") { await info.execute(interaction); return; }
    // if (interaction.commandName === "rules") { await rules.execute(interaction); return; }
    if (interaction.commandName === "infoembeds") { await infoembeds.execute(interaction); return; }

    if (interaction.commandName === "mute") { await mute.execute(interaction); return; }
    if (interaction.commandName === "unmute") { await unmute.execute(interaction); return; }

    if (interaction.commandName === "warn") { await warn.execute(interaction); return; }
    if (interaction.commandName === "unwarn") { await unwarn.execute(interaction); return; }
    if (interaction.commandName === "paywarn") { await paywarn.execute(interaction); return; }

    // 🔍 ДОБАВЬТЕ ЭТУ ПРОВЕРКУ:
    if (!command) {
        console.error(`❌ Команда "${interaction.commandName}" НЕ НАЙДЕНА в commands объекте!`);
        console.error("   Доступные команды:", Object.keys(commands));
        return;
    }
    
    if (typeof command.execute !== "function") {
        console.error(`❌ У команды "${interaction.commandName}" нет функции execute!`);
        return;
    }
    
    try {
        console.log(`🟢 Выполняю команду: ${interaction.commandName}`);
        await command.execute(interaction);
        console.log(`✅ Команда выполнена: ${interaction.commandName}`);
    } catch (error) {
        console.error("🔥 Ошибка:", error);
    }
});

// Запуск бота
client.once("clientReady", async (client) => {
    console.log("'DIEZE_OS' успешно запущен! 🤖");

    setupLogging(client);
    setupVoiceCoins(client);
    setupAppealHandler(client);

        for (const guild of client.guilds.cache.values()) {
            await loadTemplateChannelsCache(guild);
            await DeployCommands({guildId: guild.id,});
        console.log(`\t🟢 ${client.user?.username} авторизован на ${guild.name}`);
        }
        /*
        // Синхронизация инвентаря с реальными ролями
        for (const guild of client.guilds.cache.values()) {
            const roles = db.prepare("SELECT itemId FROM inventory WHERE guildId = ? AND itemType = 'role'").all(guild.id) as any[];
            for (const { itemId } of roles) {
                await InventoryService.syncRole(guild, itemId);
            }
        }
            */
});

// СБОР СТАТЫ ПОЛЬЗОВАТЕЛЯ

client.on("messageCreate", async (message) => {
    try{
        // ✅ 1. ФИКС ДВОЙНОГО СРАБАТЫВАНИЯ
        if (message.partial) return;

        if (message.author.bot)
            return;
        if (!message.guild)
            return;

        const userId = message.author.id;
        const now = Date.now();
        const COOLDOWN_MS = 60 * 1000; // 1 минута

        // Проверяем кулдаун
        const user = db.prepare("SELECT last_message_cooldown FROM users WHERE userId = ?").get(userId) as any;
        if (user?.last_message_cooldown) {
            const lastMsg = new Date(user.last_message_cooldown).getTime();
            if (now - lastMsg < COOLDOWN_MS) return;
        }

        // ✅ 2. Оптимизированный SQL (прямое сложение, надёжнее COALESCE)
        db.prepare(`
            INSERT INTO users (userId, coins, messages, last_message_cooldown)
            VALUES (?, 2, 1, ?)
            ON CONFLICT(userId) DO UPDATE SET
                coins = coins + 2,
                messages = messages + 1,
                last_message_cooldown = excluded.last_message_cooldown
        `).run(userId, new Date(now).toISOString());
    } catch (error) {
        console.error("❌ Ошибка в messageCreate:", error);
    }
});


// VOICE

export const voiceSessions = new Map<string, {
        channelId: string,
        joinedAt: number
    }>();

    setInterval(async () => {

        for (const [userId] of voiceSessions.entries()) {

            try {

                const guild = client.guilds.cache.first();
                    if (!guild) continue;

                const member = await guild.members.fetch(userId);

                // 🚫 Антифарм
                    if (
                        member.voice.selfMute ||
                        member.voice.selfDeaf ||
                        member.voice.serverMute ||
                        member.voice.serverDeaf
                    ) {
                        continue;
                    }

                    // 🚫 AFK канал
                    if (
                        guild.afkChannelId &&
                        member.voice.channelId === guild.afkChannelId
                    ) {
                        continue;
                    }
                    
                addVoiceTime(userId, 60);

                    await giveVoiceRoles(client, member, userId);

                    } catch (err) {
                        console.log(`Voice tracker error (${userId}):`, err);
                    }
        }
    }, 60000);
// VOICE

// СБОР СТАТЫ ПОЛЬЗОВАТЕЛЯ


// LOGS

process.on("unhandledRejection", (error) => {
  console.error("UNHANDLED REJECTION:", error);
});

process.on("uncaughtException", (error) => {
  console.error("UNCAUGHT EXCEPTION:", error);
});

    // Авто-проверка истёкших банов (каждую минуту)
    setInterval(() => {
        BanService.checkExpiredBans(client).catch(console.error);
    }, 60000); // Каждые 60 секунд

    // Запуск обработчика апелляций
    setupAppealHandler(client);

// LOGS

client.login(config.DISCORD_TOKEN);
