import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../database/database";
import { InventoryService } from "../services/inventory.service"; // ✅ Этот сервис у тебя есть
import { sendLog } from "../services/logs.service";

export const createrole = {
    data: new SlashCommandBuilder()
        .setName("createrole")
        .setDescription("Создать личную роль за 5,000 монет")
        .addStringOption(opt => 
            opt.setName("name")
                .setDescription("Название роли (макс. 100 символов)")
                .setRequired(true)
                .setMaxLength(100)
        )
        .addStringOption(opt =>
            opt.setName("color")
                .setDescription("Цвет роли в HEX (например: FF0000)")
                .setRequired(true)
                .setMaxLength(6)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || !interaction.member) {
            return interaction.reply({ content: "❌ Команда работает только на сервере", flags: 64 });
        }

        const name = interaction.options.getString("name", true);
        const colorInput = interaction.options.getString("color", true);
        const colorHex = colorInput.replace("#", "").toUpperCase();

        // Проверка формата цвета
        if (!/^[0-9A-F]{6}$/.test(colorHex)) {
            return interaction.reply({ 
                content: "❌ Неверный формат цвета. Используйте HEX (например: `FF0000`)", 
                flags: 64 
            });
        }

        const color = parseInt(colorHex, 16);
        const COST = 5000;

        // Проверка баланса
        const user = db.prepare("SELECT coins FROM users WHERE userId = ?").get(interaction.user.id) as any;
        const userCoins = user?.coins || 0;

        if (userCoins < COST) {
            return interaction.reply({ 
                content: `❌ Недостаточно монет. Нужно ${COST}, у вас ${userCoins}`, 
                flags: 64 
            });
        }

        await interaction.deferReply({ flags: 64 });

        try {
            // 1. Создаём роль в Discord
            const role = await interaction.guild.roles.create({
                name: name.slice(0, 100),
                color: `#${colorHex}`,
                reason: `Личная роль для ${interaction.user.tag} (за ${COST} монет)`
            });

            // ✅ Выдаём роль (с проверкой на дубликат)
            const member = await interaction.guild.members.fetch(interaction.user.id);
            if (!member.roles.cache.has(role.id)) {
                await member.roles.add(role);
            }

            // 2. Списываем монеты
            db.prepare("UPDATE users SET coins = coins - ? WHERE userId = ?").run(COST, interaction.user.id);

            // 3. Добавляем роль в инвентарь
            await InventoryService.addItem(
                interaction.user.id,
                interaction.guild.id,
                'role',
                role.id,
                name,
                color
            );

            // 4. Логирование
            const embed = new EmbedBuilder()
                .setColor(0x22c55e)
                .setTitle("🎨 Создана личная роль")
                .addFields(
                    { name: "👤 Пользователь", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "🎭 Роль", value: `${role.name} (${role})`, inline: true },
                    { name: "💰 Списано", value: `${COST} монет`, inline: true },
                    { name: "🎨 Цвет", value: `#${colorHex}`, inline: true }
                )
                .setTimestamp();
            await sendLog(interaction.guild, embed).catch(() => {});

            await interaction.editReply({ 
                content: `✅ Личная роль **${name}** создана и добавлена в инвентарь!\n💰 Списано ${COST} монет` 
            });

        } catch (error: any) {
            console.error("❌ Ошибка создания роли:", error);
            await interaction.editReply({ content: `❌ Ошибка: ${error.message}` });
        }
    }
};