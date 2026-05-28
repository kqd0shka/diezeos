import { REST, Routes } from "discord.js";
import { config } from "../config";

async function clearCommands() {
    const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
    
    // Очистка глобальных команд
    await rest.put(Routes.applicationCommands(config.DISCORD_CLIENT_ID), { body: [] });
    console.log("✅ Глобальные команды очищены");
    
    // Очистка команд на гильдии (если есть)
    const GUILD_ID = "1502214548822818857"; // Замените на реальный ID
    await rest.put(Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, GUILD_ID), { body: [] });
    console.log("✅ Команды на гильдии очищены");
    
    console.log("🔄 Теперь запустите бота — команды зарегистрируются заново");
    process.exit(0);
}

clearCommands();