import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { db } from "../database/database";
import { sendLog } from "../services/logs.service";

export const givecoin = {
    data: new SlashCommandBuilder()
        .setName("givecoin")
        .setDescription("Выдать монеты пользователю")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) //  Можно изменить на свою роль/право
        .addUserOption(opt =>
            opt.setName("user")
                .setDescription("Получатель")
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName("amount")
                .setDescription("Количество монет")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const target = interaction.options.getUser("user", true);
        const amount = interaction.options.getInteger("amount", true);

        await interaction.deferReply({ flags: 64 });

        try {
            // ✅ Безопасное обновление: создаст запись если нет, либо добавит монеты
            db.prepare(`
                INSERT INTO users (userId, coins) VALUES (?, ?)
                ON CONFLICT(userId) DO UPDATE SET coins = coins + excluded.coins
            `).run(target.id, amount);

            // Получаем новый баланс для ответа
            const row = db.prepare("SELECT coins FROM users WHERE userId = ?").get(target.id) as { coins: number };
            const newBalance = row?.coins || 0;

            const embed = new EmbedBuilder()
                .setTitle("💰 Монеты выданы")
                .setColor("Green")
                .addFields(
                    { name: "👤 Получатель", value: `<@${target.id}>`, inline: true },
                    { name: "💵 Выдано", value: `+${amount}`, inline: true },
                    { name: "💳 Новый баланс", value: `${newBalance}`, inline: true }
                )
                .setFooter({ text: `Модератор: ${interaction.user.tag}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // 📜 Логирование (если настроен канал логов)
            await sendLog(interaction.guild, embed).catch(() => {});

        } catch (error: any) {
            console.error("❌ Ошибка выдачи монет:", error);
            await interaction.editReply({ content: `❌ Ошибка: ${error.message}` });
        }
    }
};