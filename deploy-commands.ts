// deploy-commands.ts
import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
config();

export async function deployCommands(clientId: string, guildId: string, commands: any[]) {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);
    
    try {
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log('✅ Команды зарегистрированы');
    } catch (error) {
        console.error('❌ Ошибка регистрации команд:', error);
    }
}
