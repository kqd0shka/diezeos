import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    TextChannel, 
    Embed
} from "discord.js";
import { sendLog } from "../services/logs.service"; // Если нет → удали строку и блок логирования

export const infoembeds = {
    data: new SlashCommandBuilder()
        .setName("infoembeds")
        .setDescription("Отправить форматированное эмбед-сообщение (только для администраторов)")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(opt =>
            opt.setName("type")
                .setDescription("Тип сообщения")
                .setRequired(true)
                .addChoices(
                    { name: "📜 Правила", value: "rules" },
                    { name: "ℹ️ Информация", value: "info" },
                    { name: "🔧 Команды", value: "commands" }
                )
        )
        .addChannelOption(opt =>
            opt.setName("channel")
                .setDescription("Канал для отправки (по умолчанию текущий)")
                .addChannelTypes(0) // 0 = Текстовый канал
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;

        const type = interaction.options.getString("type", true);
        const targetChannel = interaction.options.getChannel("channel") as TextChannel | null;
        const channel = targetChannel || (interaction.channel as TextChannel);

        if (!channel?.isTextBased()) {
            return interaction.reply({ content: "❌ Укажите текстовый канал.", flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const now = Date.now();
        const guildName = interaction.guild.name;
        const guildIcon = interaction.guild.iconURL();

        function createRuleEmbed() {
            return [
                new EmbedBuilder()
                .setTitle(" Правила сервера DIEZE") // ⚠️ Markdown здесь НЕ работает
                .setColor("DarkRed")
                .setDescription(`> **Внимание!** Нарушение правил влечёт за собой санкции вплоть до **перманентного бана** Незнание правил, не освобождает от ответственности!.\n
                    📅 Правила вступили в свою силу: <t:${now}:R>\n
                    🛡️ Ответственные: <@&1294402127866892419>
                    `),
            
                new EmbedBuilder()
                .setTitle("📖 [1. Общие правила]")
                .addFields(
                    { name: "🔹  **1.1** | Запрещено оскорбление сервера , его администрации, а также участников сервера.\n", value: "\`\`\`Наказание:\nBan ( 5 дн ) \`\`\`" },
                    { name: "🔹  **1.2** | Запрещено спамить упоминаниями (@).\n", value: "\`\`\`Наказание:\nMute chat | ( 6-12 ч ) \`\`\`" },
                    { name: "🔹  **1.3** | Запрещен флуд (частая отправка однотипных сообщений).\n", value: "\`\`\`Наказание:\nMute chat | ( 4-8 ч ) \`\`\`" },
                    { name: "🔹  **1.4** | Запрещены угрозы в любой форме участникам дискорд сервера.\n", value: "\`\`\`Наказание:\nBan ( 10 дн ) \`\`\`" },
                    { name: "🔹  **1.5** | Запрещен постинг любого NSFW контента в общедоступных каналах.\n", value: "\`\`\`Наказание:\nMute chat ИЛИ Отстранение от канала ( 12-24 ч ) \`\`\`" },
                    { name: "🔹  **1.6** | Запрещены провокации администрации и участников дискорд-сервера, а также токсичное поведение в чатах и голосовых каналах.\n", value: "\`\`\`Наказание:\nKick \`\`\`" },
                    { name: "🔹  **1.7** | Запрещено постить контент с содержанием других проектов.\n", value: "\`Исключение: обсуждение или упоминание проекта.\`\n\`\`\`Наказание:\nОтстранение ( 6 ч) \`\`\`" },
                    { name: "🔹  **1.8** | Запрещено распространение любых файлов.", value: "\`Исключение: картинки, гифки, видео.\`\n\`\`\`Наказание:\nMute chat ( 12 ч ) \`\`\`" },
                    { name: "🔹  **1.9** | Запрещено иметь аватарки (или статусы) содержащие оскорбительный или NSFW контент.\n", value: "\`\`\`Наказание:\nWarn | Kick | Ban ( 1 дн ) \`\`\`" },
                    { name: "🔹  **1.10** | Запрещено выдавать себя за модератора / администратора / команду проекта / руководство проекта.\n", value: "\`\`\`Наказание:\nBan ( 5 дн ) \`\`\`" },
                    { name: "🔹  **1.11** | Запрещено @упоминать руководство проекта без весомых на то причин.\n", value: "\`\`\`Наказание:\nMute chat ( 6 ч ) \`\`\`" },
                    { name: "🔹  **1.12** | Запрещены любые политические лозунги, высказывания, агитации, споры, обсуждения и т.п\n", value: "\`\`\`Наказание:\nBan ( 5 дн ) \`\`\`" },
                    { name: "🔹  **1.13** | Запрещена дезинформация игроков.\n", value: "\`\`\`Наказание:\nMute chat ( 2 ч ) \`\`\`" },
                    { name: "🔹  **1.14** | Запрещены ники/статусы на сервере (названия преступных организаций, ники, оскорбляющие других пользователей, нацию и т.д.).\n", value: "\`\`\`Наказание:\nWarn( x2 ) | Ban ( 6 ч ) \`\`\`" },
                    { name: "🔹  **1.15** | Запрещены любые политические лозунги, высказывания, агитации, споры, обсуждения и т.п\n", value: "\`\`\`Наказание:\nMute chat ( 6 ч ) \`\`\`" },
                ),

                new EmbedBuilder()
                .setTitle("🎙️ [2. Правила голосовых каналов]")
                .addFields(
                    { name: "🔹  **2.1** | Запрещено использование стороннего ПО для воспроизведения или изменения звука (Soundpad, MorphVOX, «Стерео микшер» и т.д.) без согласия участников канала.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 2 ч ) \`\`\`" },
                    { name: "🔹  **2.2** | Запрещено использовать ненастроенный микрофон с чрезмерным усилением, сильным фоновым шумом, шипением или треском.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 1 ч ) \`\`\`" },
                    { name: "🔹  **2.3** | Запрещено оскорбление участников, администрации в голосовых каналах.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 5 ч ) \`\`\`" },
                    { name: "🔹  **2.4** | Запрещены оскорбления, провокации и неадекватное поведение в любых проявлениях.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 6 ч ) | Ban ( 12 ч ) \`\`\`" },
                ),

                new EmbedBuilder()
                .setTitle("💬 [3. Правила текстовых каналов]")
                .addFields(
                    { name: "🔹  **3.1** | Запрещено оскорбление/унижение/травля участников сервера.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 5 ч ) \`\`\`" },
                    { name: "🔹  **3.2** | Упоминание общих тегов (@everyone / @here) без разрешения руководства запрещено для всех участников, не имеющих на это специальных прав.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 1 ч ) \`\`\`" },
                    { name: "🔹  **3.3** | Запрещено инициировать конфликты, а также принимать участие в провокациях.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 3 ч ) \`\`\`" },
                    { name: "🔹  **3.4** | Запрещены любые оскорбительные упоминания и завуалированные оскорбления семьи, родственников и близких.\n", value: "\`\`\`Наказание:\nBan ( 7 дн ) \`\`\`" },
                    { name: "🔹  **3.5** | Запрещен спам, флуд, злоупотребление CAPS LOCK, оффтоп и массовый тег пользователей.\n", value: "\`\`\`Наказание:\nWarn | Mute ( 1 ч ) \`\`\`" },
                    { name: "🔹  **3.6** | Запрещены любые проявления расизма, ксенофобии, национализма и дискриминации.\n", value: "\`\`\`Наказание:\nBan ( 7 дн ) \`\`\`" },
                    { name: "🔹  **3.7** | Запрещено попрошайничество (выпрашивание привилегий, игровой валюты, доната и т.д.).\n", value: "\`\`\` Наказание:\nWarn | Mute ( 4 ч ) \`\`\`" },
                )
            ]
        }

        function createCommandsEmbed() {
            return [
                new EmbedBuilder()
                .setTitle("🌐  Доступные команды")
                .setColor("DarkPurple"),

                new EmbedBuilder()
                .setTitle("📎 [Основные команды]")
                .addFields(
                    { name: "\`/stats\`", value: "- карточка статистики пользователя\n"},
                    { name: "\`/daily\`", value: "- выдает награду в размере 20 ☠️.\n*( можно получить 1 раз в 12 часов )*.\n"},
                    { name: "\`/inventory\`", value: "- просмотр личных ролей *( можно выставить на продажу )*.\n"},
                    { name: "\`/createrole\`", value: "- позволяет создать личную роль за 5.000 ☠️\n"},
                    { name: "\`/transfer { user } { amount }\`", value: "- перевод ваших коинов ☠️ выбранному пользователю."},
                    { name: "\`/shop \`", value: "- магазин с доступными к покупке ролей.\n"},
                    { name: "\`/buyrole { role_id }  { price }\`", value: "- покупка выбранной роли в магазине.\n"},
                    { name: "\`/paywarn\` ", value: "- снятие варна за **10.000☠️**.\n"},
                    { name: "\`/rep ( give/check/top )\`", value: "- система репутаций, *( кинуть респект/проверить кол-во репутации/вывести топ по репутации )*.\n"},
                    { name: " \`/sellrole { role_id }  { price }\`", value: "- выставить личную роль на продажу.`"}
                )
            ]
        }

    try {
        if (type === "rules") {
            const embeds = createRuleEmbed();
                for (const embed of embeds) {
                    await channel.send({ embeds: [embed] });
                }
        }if (type === "info") {
            // ==========================================
            // ℹ️ ШАБЛОН ИНФОРМАЦИИ (ЗАМЕНИ ТЕКСТ ПОД СЕБЯ)
            // ==========================================
            const embed = new EmbedBuilder()
                .setTitle("ℹ️ Информация") // ⚠️ Markdown здесь НЕ работает
                .setColor("Blurple")
                .setThumbnail(interaction.guild.iconURL())
                .setDescription(`Добро пожаловать на **${interaction.guild.name}**! 🎉\n
                    **О нас:**\n
                    Мы — сообщество *"сквада"*-DIEZE\n
                    Здесь вы найдёте *_дружелюбную атмосферу_*, *_новых друзей_*, *_новых тиммейтов для любых игр_*.\n\n
                    📊 **Статистика:**\n 
                    👥 Участников: \`${interaction.guild.memberCount}\`\n
                    📅 Дата создания: <t:${Math.floor(interaction.guild.createdTimestamp / 1000)}:D>\n\n
                    💡 **Полезные ссылки:**\n[Discord](https://discord.gg/dieze) | [TG-основателя](https://t.me/DIEZEEE) | [Twitch](https://www.twitch.tv/dieze_yt)\n\n`)
                .addFields(
                    { name: "📌 Важные каналы", value: "<#1294402128223141890>  <#1500990522670715001>", inline: true },
                    { name: "🛠️ Техническая поддержка", value: "Пишите в <#1298503739929530379> чтобы создать тикет", inline: true }
                )
                    // ✅ ИСПРАВЛЕНО: Проверяем guildIcon перед установкой
                if (guildIcon) {
                    embed.setThumbnail(guildIcon);
                }
        await channel.send({ embeds: [embed] });
        }else if (type === "commands") {
            const embeds = createCommandsEmbed();
                for (const embed of embeds) {
                    await channel.send({ embeds: [embed] });
                }
        }

        const typeName = { rules: "Правила", info: "Информация", commands: "Команды" }[type] || type;
        await interaction.editReply({ content: `✅ Эмбед "${typeName}" успешно отправлен в ${channel}!` });

            // 📜 Логируем действие администратора
            const logEmbed = new EmbedBuilder()
                .setTitle("📤 Отправлен эмбед")
                .setColor("Green")
                .addFields(
                    { name: "👤 Администратор", value: `<@${interaction.user.id}>`, inline: true },
                    { name: "📝 Тип", value: typeName, inline: true },
                    { name: "📍 Канал", value: `${channel}`, inline: true }
                )
                .setTimestamp();
            await sendLog(interaction.guild, logEmbed).catch(() => {});
        } catch (error: any) {
            console.error("❌ Ошибка отправки эмбеда:", error);
            await interaction.editReply({ content: `❌ Не удалось отправить сообщение: ${error.message}` });
        }
    }
};