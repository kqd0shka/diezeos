// generate-invite.ts
import { OAuth2Scopes, PermissionFlagsBits } from "discord.js";
import { config } from "dotenv";

// Загружаем переменные из .env
config();

const clientId = process.env.DISCORD_CLIENT_ID;

if (!clientId) {
    console.error("❌ Ошибка: DISCORD_CLIENT_ID не найден в .env");
    process.exit(1);
}

// Формируем ссылку с нужными правами
const permissions = 
    PermissionFlagsBits.Administrator;

const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${OAuth2Scopes.Bot}%20${OAuth2Scopes.ApplicationsCommands}`;

console.log("🔗 Ссылка для приглашения бота:");
console.log(inviteUrl);
