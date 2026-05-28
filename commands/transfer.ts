import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../database/database";
import { sendLog } from "../services/logs.service";

export const transfer = {
    data: new SlashCommandBuilder()
        .setName("transfer")
        .setDescription("Перевести монеты другому пользователю")
        .addUserOption(opt =>
            opt.setName("user")
                .setDescription("Кому перевести")
                .setRequired(true)
        )
        .addIntegerOption(opt =>
            opt.setName("amount")
                .setDescription("Сумма перевода")
                .setRequired(true)
                .setMinValue(1)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const senderId = interaction.user.id;
        const receiver = interaction.options.getUser("user", true);
        const amount = interaction.options.getInteger("amount", true);

        // 1. Проверка: нельзя перевести самому себе
        if (receiver.id === senderId) {
            return interaction.reply({ content: " Вы не можете перевести монеты самому себе.", flags: 64 });
        }

        // 2. Проверка: нельзя перевести боту
        if (receiver.bot) {
            return interaction.reply({ content: "❌ Нельзя перевести монеты боту.", flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            // 3. Проверяем баланс отправителя
            const senderData = db.prepare("SELECT coins FROM users WHERE userId = ?").get(senderId) as any;
            const currentBalance = senderData?.coins || 0;

            if (currentBalance < amount) {
                return interaction.editReply({ 
                    content: `❌ Недостаточно средств. У вас ${currentBalance} 🪙, а нужно ${amount} 🪙.` 
                });
            }

            // 4. Выполняем перевод в транзакции (атомарно)
            // Если что-то упадет, изменения откатятся
            db.transaction(() => {
                // Списываем у отправителя
                db.prepare("UPDATE users SET coins = coins - ? WHERE userId = ?").run(amount, senderId);

                // Начисляем получателю (если его нет в базе — создаем запись)
                db.prepare(`
                    INSERT INTO users (userId, coins) VALUES (?, ?)
                    ON CONFLICT(userId) DO UPDATE SET coins = coins + ?
                `).run(receiver.id, amount, amount);
            })();

            // 5. Получаем новый баланс для отображения
            const newBalance = currentBalance - amount;

            // 6. Отправляем красивый Embed
            const embed = new EmbedBuilder()
                .setTitle("💸 Перевод выполнен")
                .setColor("Blurple")
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`Успешный перевод от <@${senderId}> к <@${receiver.id}>`)
                .addFields(
                    { name: " Сумма", value: `**${amount}** 🪙`, inline: true },
                    { name: "📉 Остаток у отправителя", value: `${newBalance} 🪙`, inline: true },
                    { name: "📈 Новый баланс получателя", value: `Обновлен`, inline: true }
                )
                .setFooter({ text: `ID перевода: ${Date.now()}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // 7. Логирование
            await sendLog(interaction.guild, embed).catch(() => {});
            
            // (Опционально) Уведомить получателя в ЛС, если открыты
            try {
                await receiver.send({
                    embeds: [new EmbedBuilder()
                        .setTitle("🎁 Вам перевод!")
                        .setDescription(`Вы получили **${amount}** монет от пользователя <@${senderId}> на сервере **${interaction.guild.name}**.`)
                        .setColor("Green")]
                });
            } catch (e) {
                // Игнорируем, если ЛС закрыты
            }

        } catch (error: any) {
            console.error("❌ Ошибка перевода:", error);
            await interaction.editReply({ content: `❌ Произошла ошибка при переводе: ${error.message}` });
        }
    }
};