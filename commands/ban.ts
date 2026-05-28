import { 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    GuildMember,
    User,
    PermissionFlagsBits
} from "discord.js";
import { BanService } from "../services/ban.service";

export const ban = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Забанить пользователя с гибкими настройками")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(opt => 
            opt.setName("user")
                .setDescription("Пользователь для бана")
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName("reason")
                .setDescription("Причина бана")
                .setRequired(true)
                .setMaxLength(500)
        )
        .addStringOption(opt =>
            opt.setName("duration")
                .setDescription("Длительность: 1y 2mo 3w 4d 5h 6m или 0 для перманента")
                .setRequired(true)
                .setMaxLength(50)
        )
        .addBooleanOption(opt =>
            opt.setName("wipe_stats")
                .setDescription("Обнулить статистику пользователя? (по умолчанию: нет)")
                .setRequired(false)
        )
        .addIntegerOption(opt =>
            opt.setName("delete_messages")
                .setDescription("Удалить сообщения за сколько дней? (0-7)")
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(7)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild || !interaction.member) {
            return interaction.reply({ content: "❌ Команда работает только на сервере", flags: 64 });
        }

        const moderator = interaction.member as GuildMember;
        const target = interaction.options.getUser("user", true);
        const reason = interaction.options.getString("reason", true);
        const duration = interaction.options.getString("duration", true);
        const wipeStats = interaction.options.getBoolean("wipe_stats") || false;
        const deleteMessages = interaction.options.getInteger("delete_messages") || 0;

        // Проверка: нельзя забанить себя
        if (target.id === moderator.id) {
            return interaction.reply({ content: "❌ Нельзя забанить самого себя", flags: 64 });
        }

        // Проверка прав
        const targetMember = await interaction.guild.members.fetch(target.id).catch(() => null);
        if (targetMember) {
            const canBan = BanService.canBan(moderator, targetMember);
            if (!canBan.can) {
                return interaction.reply({ content: canBan.reason, flags: 64 });
            }
        }

        // Отправляем "думаю"
        await interaction.deferReply({ flags: 64 });

        // Применяем бан
        const result = await BanService.applyBan(
            interaction.guild,
            target,
            moderator,
            {
                reason,
                duration,
                wipeStats,
                deleteMessageDays: deleteMessages
            }
        );

        if (!result.success) {
            return interaction.editReply({ content: result.error || "❌ Неизвестная ошибка" });
        }

        // Формируем ответ
        const parsed = BanService.parseBanDuration(duration).parsed!;
        const embed = new EmbedBuilder()
            .setTitle("✅ Пользователь забанен")
            .setColor(0xFF0000)
            .addFields(
                { name: "👤 Пользователь", value: `<@${target.id}>`, inline: true },
                { name: "📝 Причина", value: reason, inline: true },
                { name: "⏱️ Длительность", value: parsed.humanReadable, inline: true },
                { name: "🔓 Разбан", value: parsed.isPermanent ? "Никогда" : `Через ${parsed.humanReadable}`, inline: true },
                { name: "🗑️ Статистика", value: wipeStats ? "❌ Обнулена" : "✅ Сохранена", inline: true }
            )
            .setFooter({ text: `ID бана: ${result.banId}` })
            .setTimestamp();

                    // ✅ ОТПРАВКА ЛС ПОЛЬЗОВАТЕЛЮ
        try {
            const appealEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle("🔨 Вы были забанены")
                .setDescription(`На сервере **${interaction.guild.name}**`)
                .addFields(
                    { name: "👮 Модератор", value: `<@${moderator.id}>`, inline: true },
                    { name: "📝 Причина", value: reason, inline: false },
                    { name: "⏱️ Длительность", value: parsed.humanReadable, inline: true },
                    { name: "🔓 Разбан", value: parsed.isPermanent ? "Никогда" : `Через ${parsed.humanReadable}`, inline: true }
                )
                .setFooter({ text: "💬 Чтобы подать апелляцию, напишите боту в ЛС `/appeal`" })
                .setTimestamp();
            
            await target.send({ embeds: [appealEmbed] }).catch((err: any) => {

            });

        } catch (err: any) {

        }

        await interaction.editReply({ embeds: [embed] });
    }
};