import { REST, Routes } from "discord.js";
import { config } from "./config";
import { commands } from "./commands";

export async function DeployCommands({ guildId }: { guildId?: string }) {
    const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
    const commandsData = Object.values(commands).map(cmd => cmd.data.toJSON());

    try {
        console.log(`🔄 Регистрация ${commandsData.length} команд...`);
        
        if (guildId) {
            // Гильд-команды (мгновенно)
            await rest.put(
                Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
                { body: commandsData }
            );
            console.log("✅ Гильд-команды зарегистрированы!");
        }
        // Если guildId не передан — глобальные команды не регистрируем (чтобы не дублировать)
        
    } catch (error) {
        console.error("❌ Ошибка регистрации:", error);
    }
}