import { Guild, User, GuildMember, EmbedBuilder, Client, PermissionFlagsBits } from "discord.js";
import { db } from "../database/database";
import { sendLog } from "./logs.service";
import { parseDuration, ParsedDuration } from "../utils/timeParser";

export interface MuteOptions {
    reason: string;
    duration: string;
    muteType: 'voice' | 'deafen' | 'both';
}

export class MuteService {
    static parseMuteDuration(input: string): { valid: boolean; parsed?: ParsedDuration; error?: string } {
        if (!input || input.trim() === '') return { valid: false, error: "️ Укажите длительность (например: `1h 30m` или `0` для навсегда)" };
        const parsed = parseDuration(input);
        if (!parsed) return { valid: false, error: "⏱️ Неверный формат. Используйте: y, mo, w, d, h, m" };
        return { valid: true, parsed };
    }

    static async applyMute(
        guild: Guild,
        target: User,
        moderator: GuildMember,
        options: MuteOptions
    ): Promise<{ success: boolean; error?: string }> {
        const durationCheck = this.parseMuteDuration(options.duration);
        if (!durationCheck.valid) return { success: false, error: durationCheck.error };

        const parsed = durationCheck.parsed!;
        const expiresAt = parsed.isPermanent ? null : new Date(Date.now() + parsed.totalMs).toISOString();

        try {
            const member = await guild.members.fetch(target.id).catch(() => null);
            if (!member) return { success: false, error: "❌ Пользователь не найден на сервере." };

            // Применяем через Discord API
            if (options.muteType === 'voice' || options.muteType === 'both') {
                await member.voice.setMute(true, `🔇 ${moderator.user.tag}: ${options.reason}`);
            }
            if (options.muteType === 'deafen' || options.muteType === 'both') {
                await member.voice.setDeaf(true, `🔇 ${moderator.user.tag}: ${options.reason}`);
            }

            // Сохраняем в БД
            db.prepare(`
                INSERT INTO mutes (userId, guildId, moderatorId, reason, duration, expiresAt, muteType, createdAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(userId, guildId, muteType) DO UPDATE SET
                    reason = excluded.reason, duration = excluded.duration, expiresAt = excluded.expiresAt, createdAt = excluded.createdAt
            `).run(target.id, guild.id, moderator.id, options.reason, options.duration, expiresAt, options.muteType, new Date().toISOString());

            // ✅ УВЕДОМЛЕНИЕ В ЛС ПРИ МУТЕ
            try {
                const embed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(" Вы были заглушены")
                    .setDescription(`На сервере **${guild.name}**`)
                    .addFields(
                        { name: " Модератор", value: `<@${moderator.id}>`, inline: true },
                        { name: "📝 Причина", value: options.reason, inline: false },
                        { name: "️ Длительность", value: parsed.humanReadable, inline: true },
                        { name: "🔊 Тип", value: options.muteType === 'voice' ? 'Микрофон' : options.muteType === 'deafen' ? 'Микрофон + Звук' : 'Полное', inline: true }
                    )
                    .setFooter({ text: expiresAt ? "Заглушение снимется автоматически" : "Снимается только модератором" })
                    .setTimestamp();
                await target.send({ embeds: [embed] });
                console.log(`📩 [MUTE] Уведомление отправлено ${target.tag}`);
            } catch (err: any) {
                console.log(`ℹ️ [MUTE] ЛС не отправлено ${target.tag}: ${err.message}`);
            }

            await this.logMute(guild, target, moderator, options, parsed, expiresAt);
            return { success: true };
        } catch (error: any) {
            console.error("❌ Ошибка мута:", error);
            return { success: false, error: ` Ошибка: ${error.message}` };
        }
    }

    static async removeMute(
        guild: Guild,
        target: User,
        moderator: GuildMember,
        muteType: 'voice' | 'deafen' | 'both',
        reason?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const member = await guild.members.fetch(target.id).catch(() => null);
            if (!member) return { success: false, error: "❌ Пользователь не найден." };

            if (muteType === 'voice' || muteType === 'both') await member.voice.setMute(false);
            if (muteType === 'deafen' || muteType === 'both') await member.voice.setDeaf(false);

            db.prepare(`
                UPDATE mutes SET removedAt = ?, removedBy = ?, removedReason = ?
                WHERE userId = ? AND guildId = ? AND muteType = ? AND removedAt IS NULL
            `).run(new Date().toISOString(), moderator.id, reason || "Снято модератором", target.id, guild.id, muteType);

            const embed = new EmbedBuilder()
                .setColor(0x22c55e)
                .setTitle("🔊 Заглушение снято")
                .addFields(
                    { name: "👤 Пользователь", value: `<@${target.id}>`, inline: true },
                    { name: "👮 Модератор", value: `<@${moderator.id}>`, inline: true },
                    { name: " Причина", value: reason || "Не указана", inline: false }
                )
                .setTimestamp();
            await sendLog(guild, embed).catch(() => {});

            return { success: true };
        } catch (error: any) {
            return { success: false, error: `❌ Ошибка: ${error.message}` };
        }
    }

    static async checkExpiredMutes(client: Client) {
        const now = new Date().toISOString();
        const expired = db.prepare(`
            SELECT userId, guildId, muteType, reason FROM mutes
            WHERE expiresAt IS NOT NULL AND expiresAt <= ? AND removedAt IS NULL
        `).all(now) as Array<{ userId: string; guildId: string; muteType: string; reason: string }>;

        for (const mute of expired) {
            try {
                const guild = await client.guilds.fetch(mute.guildId).catch(() => null);
                if (!guild) {
                    db.prepare("UPDATE mutes SET removedAt = ?, removedBy = ? WHERE userId = ? AND guildId = ? AND muteType = ?")
                      .run(new Date().toISOString(), 'system', mute.userId, mute.guildId, mute.muteType);
                    continue;
                }

                const member = await guild.members.fetch(mute.userId).catch(() => null);
                if (member) {
                    if (mute.muteType === 'voice' || mute.muteType === 'both') await member.voice.setMute(false);
                    if (mute.muteType === 'deafen' || mute.muteType === 'both') await member.voice.setDeaf(false);
                }

                db.prepare("UPDATE mutes SET removedAt = ?, removedBy = ? WHERE userId = ? AND guildId = ? AND muteType = ?")
                  .run(new Date().toISOString(), 'system', mute.userId, mute.guildId, mute.muteType);

                // ✅ УВЕДОМЛЕНИЕ В ЛС ПРИ АВТО-СНЯТИИ
                try {
                    const user = await client.users.fetch(mute.userId);
                    const embed = new EmbedBuilder()
                        .setColor(0x22c55e)
                        .setTitle("🔊 Ваше заглушение истекло")
                        .setDescription(`Заглушение на сервере **${guild.name}** автоматически снято.`)
                        .addFields(
                            { name: " Причина", value: mute.reason, inline: false },
                            { name: "🔓 Статус", value: "**Снято**", inline: true }
                        )
                        .setFooter({ text: "Теперь вы можете снова использовать голосовой чат" })
                        .setTimestamp();
                    await user.send({ embeds: [embed] });
                    console.log(`📩 [AUTO-UNMUTE] Уведомление отправлено ${user.tag}`);
                } catch {}

                console.log(`✅ [AUTO-UNMUTE] Снято с ${mute.userId} на ${mute.guildId}`);
            } catch (err) {
                console.error(`❌ [AUTO-UNMUTE] Ошибка:`, err);
            }
        }
    }

    private static async logMute(guild: Guild, target: User, moderator: GuildMember, options: MuteOptions, parsed: ParsedDuration, expiresAt: string | null) {
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle("🔇 Пользователь заглушен")
            .addFields(
                { name: "👤 Пользователь", value: `<@${target.id}>`, inline: true },
                { name: "👮 Модератор", value: `<@${moderator.id}>`, inline: true },
                { name: " Причина", value: options.reason, inline: false },
                { name: "⏱️ Длительность", value: parsed.humanReadable, inline: true },
                { name: "🔓 Снятие", value: expiresAt ? `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>` : "Вручную", inline: true },
                { name: " Тип", value: options.muteType === 'voice' ? 'Микрофон' : options.muteType === 'deafen' ? 'Микрофон + Звук' : 'Полное', inline: true }
            )
            .setTimestamp();
        await sendLog(guild, embed).catch(() => {});
    }
}