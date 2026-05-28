import { Guild, GuildMember, VoiceChannel, PermissionFlagsBits, OverwriteType } from "discord.js";
import { db } from "../database/database";

export const TEMPLATE_CHANNEL_ID = "1506545179031638126";

const channelOwners = new Map<string, string>();

export async function loadTemplateChannelsCache(guild: Guild) {
    const rows = db.prepare("SELECT channelId, ownerId FROM temp_channels").all() as any[];
    for (const row of rows) {
        channelOwners.set(row.channelId, row.ownerId);
    }
    console.log(`📦 Загружено ${rows.length} временных каналов в кэш`);
}

/**
 * Проверяет, является ли участник владельцем канала
 */
export function isChannelOwner(channelId: string, userId: string): boolean {
    return channelOwners.get(channelId) === userId;
}

/**
 * Создает временный канал для пользователя
 */
export async function createTempChannel(member: GuildMember, templateChannel: VoiceChannel): Promise<VoiceChannel | null> {
    try {
        // Создаем канал с правами: владелец = админ, @everyone = читать
        const newChannel = await templateChannel.clone({
            name: `🔊 │ ${member.displayName}`,
            parent: templateChannel.parent,
            reason: `Временная комната для ${member.displayName}`,
            permissionOverwrites: [
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.MuteMembers],
                    type: OverwriteType.Member
                },
                {
                    id: member.guild.roles.everyone.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak],
                    deny: [PermissionFlagsBits.ManageChannels],
                    type: OverwriteType.Role
                }
            ]
        });

        // Сохраняем в БД и кэш
        db.prepare(`
            INSERT INTO temp_channels (channelId, ownerId, createdAt) VALUES (?, ?, ?)
        `).run(newChannel.id, member.id, new Date().toISOString());
        
        channelOwners.set(newChannel.id, member.id);

        // Перемещаем пользователя в новый канал
        await member.voice.setChannel(newChannel);

        console.log(`🎤 Создана комната ${newChannel.name} для ${member.displayName}`);
        return newChannel;

    } catch (error) {
        console.error("❌ Ошибка создания канала:", error);
        return null;
    }
}

/**
 * Удаляет временный канал и очищает данные
 */
export async function deleteTempChannel(channelId: string, guild: Guild): Promise<boolean> {
    try {
        // Удаляем из БД
        db.prepare("DELETE FROM temp_channels WHERE channelId = ?").run(channelId);
        channelOwners.delete(channelId);

        // Удаляем сам канал в Discord
        const channel = guild.channels.cache.get(channelId) as VoiceChannel | undefined;

        if (channel) {
            await channel.delete("Временная комната пуcтая");
            console.log(`🗑️ Удалена пустая комната ${channel.name} ${channelId}`);
        }
        return true;
    } catch (error) {
        console.error("❌ Ошибка удаления канала:", error);
        return false;
    }
}

/**
 * Команды управления комнатой
 */
export const VoiceRoomCommands = {
    /**
     * Изменить название комнаты
     */
    async setName(channel: VoiceChannel, userId: string, newName: string): Promise<string> {
        if (!isChannelOwner(channel.id, userId)) return "❌ Вы не владелец этой комнаты!";
        if (newName.length > 100) return "❌ Название слишком длинное (макс. 100 символов)!";
        
        await channel.setName(newName);
        return `✅ Название изменено на: **${newName}**`;
    },

    /**
     * Установить лимит пользователей
     */
    async setLimit(channel: VoiceChannel, userId: string, limit: number): Promise<string> {
        if (!isChannelOwner(channel.id, userId)) return "❌ Вы не владелец этой комнаты!";
        if (limit < 0 || limit > 99) return "❌ Лимит должен быть от 0 до 99 (0 = безлимита)!";
        
        await channel.setUserLimit(limit);
        return limit === 0 ? `✅ Лимит снят` : `✅ Лимит установлен: **${limit}**`;
    },

    /**
     * Закрыть/открыть комнату (приватность)
     */
    async toggleLock(channel: VoiceChannel, userId: string): Promise<string> {
        if (!isChannelOwner(channel.id, userId)) return "❌ Вы не владелец этой комнаты!";
        
        const everyoneOverwrite = channel.permissionOverwrites.cache.get(channel.guild.roles.everyone.id);
        const isLocked = everyoneOverwrite?.deny.has(PermissionFlagsBits.Connect);
        
        if (isLocked) {
            // Открываем: разрешаем подключение всем
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone.id, { Connect: true });
            return "🔓 Комната открыта для всех";
        } else {
            // Закрываем: запрещаем подключение всем, кроме владельца
            await channel.permissionOverwrites.edit(channel.guild.roles.everyone.id, { Connect: false });
            return "🔒 Комната закрыта (приватная)";
        }
    },

    /**
     * Кикнуть пользователя из комнаты
     */
    async kickUser(channel: VoiceChannel, ownerId: string, targetMember: GuildMember): Promise<string> {
        if (!isChannelOwner(channel.id, ownerId)) return "❌ Вы не владелец этой комнаты!";
        if (!targetMember.voice.channel || targetMember.voice.channel.id !== channel.id) {
            return "❌ Пользователь не в этой комнате!";
        }
        if (targetMember.permissions.has(PermissionFlagsBits.Administrator)) {
            return "❌ Нельзя кикнуть администратора!";
        }
        
        try {
            await targetMember.voice.disconnect("Выгнан владельцем комнаты");
            return `👢 **${targetMember.displayName}** выгнан из комнаты`;
        } catch {
            return "❌ Не удалось выгнать пользователя";
        }
    }
};