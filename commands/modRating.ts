import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { db } from "../database/database";

export const modrating = {
    data: new SlashCommandBuilder()
        .setName("modrating")
        .setDescription("Рейтинг модераторов по оценкам за тикеты")
        .addUserOption(option =>
            option.setName("user")
                .setDescription("Посмотреть рейтинг конкретного модератора")
                .setRequired(false)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const targetUser = interaction.options.getUser("user");

        if (targetUser) {
            // 🔹 Рейтинг конкретного модератора
            const stats = db.prepare(`
                SELECT 
                    COUNT(*) as total_tickets,
                    AVG(rating) as avg_rating,
                    SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as five_stars,
                    SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as four_stars,
                    SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as three_stars,
                    SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as two_stars,
                    SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as one_star
                FROM ticket_ratings
                WHERE moderatorId = ?
            `).get(targetUser.id) as any;

            if (!stats || stats.total_tickets === 0) {
                return interaction.reply({ 
                    content: `❌ У **${targetUser.id}** ещё нет оценок`, 
                    flags: 64 
                });
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 Рейтинг: ${targetUser.tag}`)
                .setColor(0xFFD700)
                .addFields(
                    { name: '⭐ Средняя оценка', value: `${stats.avg_rating?.toFixed(2) || '0'}/5`, inline: true },
                    { name: '🎫 Всего тикетов', value: `${stats.total_tickets}`, inline: true },
                    { name: '\u200b', value: '\u200b', inline: true },
                    { name: '⭐⭐⭐⭐⭐', value: `${stats.five_stars || 0}`, inline: true },
                    { name: '⭐⭐⭐⭐', value: `${stats.four_stars || 0}`, inline: true },
                    { name: '⭐⭐⭐', value: `${stats.three_stars || 0}`, inline: true },
                    { name: '⭐⭐', value: `${stats.two_stars || 0}`, inline: true },
                    { name: '⭐', value: `${stats.one_star || 0}`, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });

        } else {
            // 🔹 Общий топ модераторов
            const topModerators = db.prepare(`
                SELECT 
                    tr.moderatorId,
                    COUNT(*) as total_ratings,
                    AVG(tr.rating) as avg_rating
                FROM ticket_ratings tr
                INNER JOIN tickets t ON tr.ticketId = t.ticketId
                WHERE tr.moderatorId IN (
                    SELECT userId FROM users WHERE userId IN (
                        SELECT moderatorId FROM ticket_ratings GROUP BY moderatorId
                        )
                    )
                GROUP BY tr.moderatorId
                HAVING COUNT(*) >= 1
                ORDER BY 
                    avg_rating DESC, 
                    total_ratings DESC
                LIMIT 5
            `).all() as any[];

            const moderatorRoleNames = ['Модератор', 'Администратор'];
            const filteredTop = topModerators.filter(mod => {
                const member = interaction.guild?.members.cache.get(mod.moderatorId);
                if (!member) return false;

                return member.roles.cache.some(role => 
                    moderatorRoleNames.some(name => role.name.toLowerCase().includes(name.toLowerCase()))
                );
            });

            const embed = new EmbedBuilder()
                .setTitle("🏆 Топ модераторов")
                .setColor(0x3498db)
                .setDescription(
                    filteredTop.map((mod, index) => {
                        const position = index + 1;
                        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔹';
                        const stars = '⭐'.repeat(Math.round(mod.avg_rating));
                        return ` **${position}.** ${medal} <@${mod.moderatorId}>\n\n └─ 🎫 **${mod.total_ratings}** тикетов | ${stars} **${mod.avg_rating.toFixed(2)}/5**`;
                    }).join('\n') || "❌ Нет оценок для отображения"
                )
                .setFooter({ text: `Статистика модераторов по рейтингу и количеству тикетов` })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }
    }
};