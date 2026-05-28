import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import { db } from "../database/database";
import { checkAndGrantAchievements } from "../utils/achievments";

export const giveBeta = {
    data: new SlashCommandBuilder()
        .setName("beta")
        .setDescription("Выдать роль 'Бета тестер' пользователю или группе")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(option =>
            option.setName("user").setDescription("Конкретный пользователь").setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        // 🔹 0. Защита от дублей
        if (interaction.replied || interaction.deferred) return;

        const targetUser = interaction.options.getUser("user");
        const targetRole = interaction.options.getRole("role");

        if (!targetUser && !targetRole) {
            return interaction.reply({ content: "❌ Укажите пользователя (`user`) или роль (`role`)!", flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const BETA_ROLE_ID = "1505844305149820968";
        const betaRole = await interaction.guild?.roles.fetch(BETA_ROLE_ID).catch(() => null);

        if (!betaRole) {
            return interaction.editReply("❌ Роль 'Бета тестер' не найдена в настройках.");
        }

        // Проверка иерархии
        const botHighestPos = interaction.guild?.members.me?.roles.highest?.position ?? 0;
        if (betaRole.position >= botHighestPos) {
            return interaction.editReply("❌ Роль бота должна быть ВЫШЕ роли 'Бета тестер' в настройках сервера!");
        }

        //  Сбор списка участников
        let membersToProcess: GuildMember[] = [];

        if (targetUser) {
            const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);
            if (!member || member.user.bot) {
                return interaction.editReply("❌ Пользователь не найден или это бот.");
            }
            membersToProcess = [member];
        }else if (targetRole) {
            // 🔥 Правильный способ: получить всех участников и отфильтровать
            const allMembers = await interaction.guild?.members.fetch();
            const membersWithRole = allMembers?.filter(
                member => member.roles.cache.has(targetRole.id) && !member.user.bot
            );
            
            membersToProcess = Array.from(membersWithRole?.values() || []);
            
            if (membersToProcess.length === 0) {
                return interaction.editReply("⛔ Нет участников с указанной ролью.");
            }
        }

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        // 🔹 Обработка каждого участника
        for (const member of membersToProcess) {
            try {
                // Пропускаем, если роль уже есть
                if (member.roles.cache.has(BETA_ROLE_ID)) {
                    skipCount++;
                    continue;
                }

                // Выдача роли
                await member.roles.add(betaRole);

                // Обновление БД
                db.prepare(`
                    INSERT INTO users (userId, isBetaTester) VALUES (?, 1)
                    ON CONFLICT(userId) DO UPDATE SET isBetaTester = 1
                `).run(member.id);

                // Проверка и выдача достижений
                const userData = db.prepare(`SELECT * FROM users WHERE userId = ?`).get(member.id) as any || {};
                await checkAndGrantAchievements(member.id, member, userData);

                // Уведомление в ЛС (тихо игнорируем ошибки, если ЛС закрыты)
                member.user.send({
                    content: ` **Поздравляем!**\nВам выдали роль **"Бета тестер"**!\n Достижение разблокировано!`
                }).catch(() => {});

                successCount++;

            } catch (err) {
                console.error(`⚠️ Ошибка при обработке ${member.user.tag}:`, err);
                errorCount++;
            }

            // ️ ЗАДЕРЖКА 1.5 сек между действиями, чтобы не упереться в лимиты Discord API
            if (membersToProcess.length > 1) {
                await new Promise(res => setTimeout(res, 1500));
            }
        }

        // 🔹 Итоговый отчёт
        await interaction.editReply(
            `📊 **Результат выдачи:**\n` +
            `👥 Всего обработано: **${membersToProcess.length}**\n` +
            `✅ Успешно: **${successCount}**\n` +
            `⏭️ Уже имели роль: **${skipCount}**\n` +
            `❌ Ошибки: **${errorCount}**`
        );
    },
};