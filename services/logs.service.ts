import { Guild, EmbedBuilder, TextChannel } from "discord.js";
import { db } from "../database/database";

// Получить ID канала логов для сервера
function getLogChannelId(guildId: string): string | null {
    const row = db.prepare("SELECT logChannelId FROM guild_settings WHERE guildId = ?").get(guildId) as any;
    return row?.logChannelId || null;
}

// Функция отправки лога
export async function sendLog(guild: Guild, embed: EmbedBuilder): Promise<void> {
    const logChannelId = getLogChannelId(guild.id);
    if (!logChannelId) return; // Если канал не настроен — ничего не делаем

    try {
        const channel = await guild.channels.fetch(logChannelId);
        if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({ embeds: [embed] });
        }
    } catch (err) {
        // Канал мог быть удален
        console.log("⚠️ Не удалось отправить лог (канал не найден)");
    }
}