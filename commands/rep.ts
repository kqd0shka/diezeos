import {
    Guild, 
    ChatInputCommandInteraction, 
    SlashCommandBuilder, 
    EmbedBuilder,
    User,
    GuildMember
} from "discord.js";
import { ReputationService } from "../services/reputation.service";

export const rep = {
    data: new SlashCommandBuilder()
        .setName("rep")
        .setDescription("Система репутации — поблагодарите участника!")
        .addSubcommand(cmd => 
            cmd.setName("give")
                .setDescription("Дать репутацию пользователю")
                .addUserOption(opt => 
                    opt.setName("user")
                        .setDescription("Кого поблагодарить?")
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName("reason")
                        .setDescription("Причина (необязательно)")
                        .setMaxLength(100)
                )
        )
        .addSubcommand(cmd =>
            cmd.setName("check")
                .setDescription("Проверить репутацию пользователя")
                .addUserOption(opt =>
                    opt.setName("user")
                        .setDescription("Чью репутацию проверить?")
                        .setRequired(false)
                )
        )
        .addSubcommand(cmd =>
            cmd.setName("top")
                .setDescription("Топ пользователей по репутации")
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        
        if (!guild) {
            return interaction.reply({ content: "❌ Команда работает только на сервере", ephemeral: true });
        }

        if (subcommand === "give") {
            return await handleGiveRep(interaction, guild);
        }
        
        if (subcommand === "check") {
            return await handleCheckRep(interaction, guild);
        }
        
        if (subcommand === "top") {
            return await handleTopRep(interaction, guild);
        }
    }
};

// 🔹 Дать репутацию
async function handleGiveRep(interaction: ChatInputCommandInteraction, guild: Guild) {
    const fromUser = interaction.user;
    const toUser = interaction.options.getUser("user", true);
    const reason = interaction.options.getString("reason");

    // Проверка возможности
    const check = await ReputationService.canGiveRep(fromUser.id, toUser.id, guild.id);
    if (!check.can) {
        return interaction.reply({ content: check.reason, flags: 64 });
    }

    try {
        await ReputationService.giveRep(fromUser, toUser, guild, reason || undefined);
        
        
        const embed = new EmbedBuilder()
            .setTitle("✅ Репутация выдана!")
            .setColor(0x22c55e)
            .addFields(
                { name: "🎁 От", value: `<@${fromUser.id}>`, inline: true },
                { name: "🎯 Кому", value: `<@${toUser.id}>`, inline: true },
                { name: "📊 Всего у пользователя", value: `${ReputationService.getStats(toUser.id, guild.id).received} 💢`, inline: true }
            );
        
        if (reason) {
            embed.addFields({ name: "💬 Причина", value: reason, inline: false });
        }
        
        embed.setTimestamp();

        await interaction.reply({ embeds: [embed] });
        
        // Уведомление получателю в ЛС
        try {
            await toUser.send({
                embeds: [new EmbedBuilder()
                    .setTitle("🎁 Вам дали репутацию!")
                    .setColor(0x22c55e)
                    .setDescription(`**${fromUser.tag}** поблагодарил вас на сервере **${guild.name}**${reason ? `\n\n💬 *${reason}*` : ''}`)
                    .setTimestamp()]
            });
        } catch {} // Игнорируем, если ЛС закрыты
        
    } catch (error: any) {
        await interaction.reply({ content: `❌ Ошибка: ${error.message}`, ephemeral: true });
    }
}

// 🔹 Проверить репутацию
async function handleCheckRep(interaction: ChatInputCommandInteraction, guild: Guild) {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const stats = ReputationService.getStats(targetUser.id, guild.id);
    
    const embed = new EmbedBuilder()
        .setTitle(`📊 Репутация: ${targetUser.tag}`)
        .setColor(0x3498db)
        .setThumbnail(targetUser.displayAvatarURL())
        .addFields(
            { name: "💢 Получено", value: `${stats.received}`, inline: true },
            { name: "🎁 Отдано", value: `${stats.given}`, inline: true },
            { name: "\u200b", value: "\u200b", inline: true }
        );
    
    if (stats.lastReceived) {
        const lastRep = new Date(stats.lastReceived);
        embed.addFields({ 
            name: "🕐 Последняя репутация", 
            value: `<t:${Math.floor(lastRep.getTime() / 1000)}:R>`, 
            inline: true 
        });
    }
    
    embed.setFooter({ text: "Используйте /rep give @user, чтобы поблагодарить" });
    
    await interaction.reply({ embeds: [embed] });
}

// 🔹 Топ репутации
async function handleTopRep(interaction: ChatInputCommandInteraction, guild: Guild) {
    const top = ReputationService.getTopRep(guild.id, 10);
    
    if (top.length === 0) {
        return interaction.reply({ content: "❌ Пока никто не получил репутацию", ephemeral: true });
    }
    
    const embed = new EmbedBuilder()
        .setTitle("🏆 Топ по репутации")
        .setColor(0xFFD700)
        .setDescription(
            top.map((entry, index) => {
                const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                return `${medal} **${index + 1}.** <@${entry.toUserId}> — **${entry.repCount}** 💢`;
            }).join('\n')
        )
        .setFooter({ text: "Обновляется в реальном времени" })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed] });
}