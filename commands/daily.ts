import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../database/database";

export const daily = {
    data: new SlashCommandBuilder()
        .setName("daily")
        .setDescription("Получить ежедневную награду"),

    async execute(interaction: ChatInputCommandInteraction) {
        const userId = interaction.user.id;
        const now = Date.now();
        const COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 часов

        let user = db.prepare("SELECT coins, daily_cooldown, daily_streak FROM users WHERE userId = ?").get(userId) as any;
        if (!user) {
            db.prepare("INSERT INTO users (userId, coins, daily_cooldown, daily_streak) VALUES (?, 0, NULL, 0)").run(userId);
            user = { coins: 0, daily_cooldown: null, daily_streak: 0 };
        }

                // 2. Проверка кулдауна
        if (user.daily_cooldown) {
            const lastClaim = new Date(user.daily_cooldown).getTime();
            const timeDiff = now - lastClaim;

            if (timeDiff < COOLDOWN_MS) {
                const remaining = COOLDOWN_MS - timeDiff;
                const hours = Math.floor(remaining / (1000 * 60 * 60));
                const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
                
                return interaction.reply({
                    content: `⏳ Вы уже получали награду. Следующая через **${hours}ч ${minutes}м**`,
                    flags: 64
                });
            }
        }

        // 3. Расчёт награды и стрика
        let streak = user.daily_streak || 0;
        
        // Сброс стрика, если пропущено > 48 часов
        if (user.daily_cooldown && (now - new Date(user.daily_cooldown).getTime() > COOLDOWN_MS * 2)) {
            streak = 0;
        }
        
        streak++;
        const baseReward = 20;
        const streakBonus = Math.min(streak * 10, 160); // Макс. бонус +160
        const totalReward = baseReward + streakBonus;
        const boost = baseReward * 2; // Временный буст для тестов (удваивает награду)

        // 4. Обновляем БД
        const newCooldown = new Date(now).toISOString();
        db.prepare(`
            UPDATE users 
            SET coins = coins + ?, daily_cooldown = ?, daily_streak = ? 
            WHERE userId = ?
        `).run(totalReward, newCooldown, streak, userId);

        // 5. Отправляем ответ
        const embed = new EmbedBuilder()
            .setTitle(" Ежедневная награда")
            .setColor(0x22c55e)
            .setDescription(`На ваш баланс зачислено **${totalReward} монет**!`)
            .addFields(
                { name: "💰 Базовая награда", value: `${baseReward}`, inline: true },
                { name: " Бонус за стрик", value: `+${streakBonus}`, inline: true },
                { name: "📊 Текущий стрик", value: `${streak} дн.`, inline: true }
            )
            .setFooter({ text: `Следующая награда через 12 часов` })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};