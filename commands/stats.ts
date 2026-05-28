import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, CommandInteraction, GuildMember } from "discord.js";
import { generateStatsCard } from "../utils/generateStat";
import { getUserStat } from "../services/stats.service";
import { giveVoiceRoles } from "../events/giveRoles";
import { checkAndGrantAchievements } from "../utils/achievments";
import { db } from "../database/database"; // 👈 Импорт подключения к БД
import { ReputationService } from "../services/reputation.service";
import { rep } from "./rep";
import { WarnService } from "../services/warn.service";

export function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    return `${h.toString().padStart(2, "0")} ч. ` +
           `${m.toString().padStart(2, "0")} м. `
}

export const stats = {
    data: new SlashCommandBuilder()
        .setName("stats")
        .setDescription("Статистика пользователя")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Пользователь")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // Добавь ПОСЛЕ строки 36 (в начало execute):
if (!interaction.guild) {
    return interaction.reply({ content: "❌ Команда работает только на сервере", flags: 64 });
}
    // 🔹 0. Защита: если уже отвечали — выходим
    if (interaction.replied || interaction.deferred) {
        console.warn("⚠️ Взаимодействие уже обработано");
        return;
    }

    // 🔹 1. ОДИН ответ — через reply() (надёжнее deferReply)
    try {
        await interaction.reply({ content: "⏳ Загрузка..."});
    } catch (e) {
        console.error("❌ Не удалось ответить:", e);
        return; // 🔥 Обязательно выходим!
    }

    try {
        const targetUser = interaction.options.getUser("user") || interaction.user;
        const member = await interaction.guild?.members.fetch(targetUser.id);
        const liveStatus = member?.presence?.status || "offline";
        const repStats = ReputationService.getStats(targetUser.id, interaction.guild!.id);

        // 🔹 Ищем роль модератора/админа у пользователя
        const moderatorRoleNames = ['Модератор', 'Администратор']; // Добавьте ваши названия
        const moderatorRole = member?.roles.cache.find(role => 
            moderatorRoleNames.some(name => role.name.toLowerCase().includes(name.toLowerCase()))
        );

        db.prepare(`
            INSERT INTO users (userId, userName, status) VALUES (?, ?, ?)
            ON CONFLICT(userId) DO UPDATE SET 
            userName = excluded.userName,
            status = excluded.status
        `).run(targetUser.id, targetUser.username, liveStatus);

        
 // 1. Получаем данные из БД
        const userData = db.prepare(`SELECT * FROM users WHERE userId = ?`).get(targetUser.id) as any || {
            userName: "",
            messages: 0, 
            voiceTime: 0, 
            coins: 0, 
            xp: 0, 
            level: 0,
            status: "offline",
            achievements: "[]", 
            isBetaTester: 0, 
            joinedAt: null,
            repStats: 0,
        };

            // 🔹 ПРОВЕРЯЕМ, ЯВЛЯЕТСЯ ЛИ ПОЛЬЗОВАТЕЛЬ МОДЕРАТОРОМ (есть ли оценки)
    let moderatorStats = null;
    if (userData) {
        moderatorStats = db.prepare(`
            SELECT 
                COUNT(*) as total_tickets,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_stars
            FROM ticket_ratings
            WHERE moderatorId = ?
        `).get(targetUser.id) as any;

        // Если нет ни одного тикета — обнуляем
        if (!moderatorStats || moderatorStats.total_tickets === 0) {
            moderatorStats = null;
        }
    }

        // 2. Обновляем статус и joinedAt при первом входе
        if (member && (!userData || !userData.joinedAt)) {
            db.prepare(`
                UPDATE users SET joinedAt = ? WHERE userId = ? AND joinedAt IS NULL
            `).run(member.joinedAt?.toISOString(), targetUser.id);
        }

        // 3.  ПРОВЕРЯЕМ И ВЫДАЁМ ДОСТИЖЕНИЯ
        const finalAchievements = await checkAndGrantAchievements(targetUser.id, member, userData);

        const safeStats = userData ?? {
            messages: 0,
            voiceTime: 0,
            coins: 0,
            xp: 0,
            level: 0,
            status: "offline",
            joinedAt: null,
            userAchievment: [] as string[],
            moderatorStats: 0,
            repStats: 0,
        };
        if (member) {
            await giveVoiceRoles(interaction.client, member, targetUser.id);
        }

        // 🖼️ Генерируем картинку (опционально, если функция доступна)
        let imageBuffer: Buffer | undefined;
        try {
            const avatarURL = targetUser.displayAvatarURL({
                extension: "png",
                size: 256,
                forceStatic: true
            });
            const warnCount = WarnService.getActiveCount(targetUser.id, interaction.guild.id);
            const highestRole = member.roles.highest;
            imageBuffer = await generateStatsCard(
                targetUser.username,
                safeStats.messages,
                safeStats.voiceTime,
                safeStats.coins,
                safeStats.xp,
                safeStats.level,
                avatarURL,
                safeStats.status,
                safeStats.joinedAt,
                finalAchievements,
                moderatorStats,
                moderatorRole,
                repStats,
                warnCount,
                highestRole
            );

            const attachment = new AttachmentBuilder(imageBuffer, { name: "stats.png" });
            await interaction.editReply({
                content: ``,
                files: [attachment],
            });

        } catch (err) {
            console.warn('⚠️ Не удалось сгенерировать картинку:', err);
            await interaction.editReply({
                content: `❌ *Не удалось сформировать изображение!*`
            })
        }
    } catch (error) {
         console.error("Ошибка в команде:", error);
        // Безопасный ответ, только если взаимодействие ещё живо
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply("❌ Произошла ошибка").catch(() => {});
        }
    }
    },
};