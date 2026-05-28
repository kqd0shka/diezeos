import { VoiceState, VoiceChannel } from "discord.js";
import { TEMPLATE_CHANNEL_ID, createTempChannel, deleteTempChannel, isChannelOwner } from "../services/voice_room.service";

export async function handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const guild = newState.guild;
    
    // 🔹 1. ВХОД в канал-шаблон → Создаем личную комнату
    if (newState.channelId === TEMPLATE_CHANNEL_ID && oldState.channelId !== TEMPLATE_CHANNEL_ID) {
        if (!newState.member || newState.member.user.bot) return;
        
        const templateChannel = newState.channel as VoiceChannel;
        await createTempChannel(newState.member, templateChannel);
        return;
    }

    // 🔹 2. ВЫХОД из временного канала → Проверяем, пуст ли он
    if (oldState.channelId && !newState.channelId) {
        await checkAndDeleteEmptyChannel(oldState.channelId, guild);
        return;
    }

    // 🔹 3. ПЕРЕХОД между каналами → Проверяем старый канал на пустоту
    if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        await checkAndDeleteEmptyChannel(oldState.channelId, guild);
        return;
    }
}

/**
 * Вспомогательная функция: если канал пуст и он временный — удаляем
 */
async function checkAndDeleteEmptyChannel(channelId: string | null, guild: any) {
    if (!channelId) return;
    
    // Проверяем, есть ли канал в нашей БД (значит он временный)
    const row = db.prepare("SELECT ownerId FROM temp_channels WHERE channelId = ?").get(channelId);
    if (!row) return; // Это обычный канал, не трогаем

    // Небольшая задержка, чтобы дать времени на обновление кэша участников
    setTimeout(async () => {
        const channel = guild.channels.cache.get(channelId) as VoiceChannel;
        if (!channel || !channel) return;
        
        // Если в канале никого нет (кроме бота) — удаляем
        const members = channel.members.filter(m => !m.user.bot);
        if (members.size === 0) {
            await deleteTempChannel(channelId, guild);
        }
    }, 500); // 1 секунды задержки
}

// Импортируем db здесь, чтобы избежать циклических зависимостей
import { db } from "../database/database";