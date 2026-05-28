// Создайте временный файл generate-invite.ts
import { OAuth2Scopes, PermissionFlagsBits } from "discord.js";
import { config } from "../config";

const invite = `https://discord.com/oauth2/authorize?client_id=${config.DISCORD_CLIENT_ID}&permissions=${PermissionFlagsBits.ManageRoles | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ReadMessageHistory}&scope=${OAuth2Scopes.Bot}%20${OAuth2Scopes.ApplicationsCommands}`;

console.log("🔗 Ссылка для приглашения бота:");
console.log(invite);