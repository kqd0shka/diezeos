import { 
    ModalSubmitInteraction, 
    StringSelectMenuInteraction, 
    ActionRowBuilder, 
    ButtonBuilder,
    ButtonInteraction, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle,
    EmbedBuilder,
    User,
    TextChannel,
    Guild
} from "discord.js";
import { TICKET_CATEGORIES } from "../config/ticket_categories";
import { createTicket, closeAndArchiveTicket, deleteActiveTicketMessage, getTicketSettings } from "../services/ticket.service";
import { db } from "../database/database";

export async function handleTicketModal(
    interaction: ModalSubmitInteraction | StringSelectMenuInteraction | ButtonInteraction
) {
    try {
        // 🔹 Кнопка ЗАКРЫТЬ тикет (пользователь)
// 🔹 Кнопка ЗАКРЫТЬ тикет
if (interaction.isButton() && interaction.customId.startsWith("ticket_close_button_")) {
    const parts = interaction.customId.split("_");
    const ticketId = parts[3];
    const authorId = parts[4];

    // ✅ Запрашиваем userId И acceptedBy из БД
    const ticket = db.prepare("SELECT userId, acceptedBy FROM tickets WHERE ticketId = ?").get(ticketId) as any;

    // ✅ Показываем оценку ТОЛЬКО если:
    // 1. Закрывает АВТОР тикета
    // 2. Тикет был ПРИНЯТ модератором (acceptedBy !== null)
    const canRate = interaction.user.id === authorId && !!ticket?.acceptedBy;

    const modal = new ModalBuilder()
        .setCustomId(`ticket_close_${ticketId}`)
        .setTitle('🔒 Закрыть тикет');

    const reasonInput = new TextInputBuilder()
        .setCustomId('close_reason')
        .setLabel('Причина закрытия')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Вопрос решён')
        .setRequired(true)
        .setMaxLength(100);

    const components = [
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    ];

    // ✅ Добавляем поля оценки только при выполнении условия canRate
    if (canRate && authorId != ticket.acceptedBy) {
        const ratingInput = new TextInputBuilder()
            .setCustomId('close_rating')
            .setLabel('Оценка работы модератора (1-5)')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('5')
            .setRequired(false)
            .setMaxLength(1);

        const commentInput = new TextInputBuilder()
            .setCustomId('close_comment')
            .setLabel('Комментарий (необязательно)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(false);

        components.push(
            new ActionRowBuilder<TextInputBuilder>().addComponents(ratingInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(commentInput)
        );
    }

    modal.addComponents(...components);
    await interaction.showModal(modal);
    return;
}
    } catch (error) {
        console.error("❌ Ошибка при обработке тикета:", error);
    }

        // 🔹 Кнопка ПРИНЯТЬ тикет (админ)
        if (interaction.isButton() && interaction.customId.startsWith("ticket_accept_")) {
            const ticketId = interaction.customId.split("_")[2];
            await handleAcceptTicket(interaction, ticketId);
            return;
        }

        // 🔹 Кнопка ОТКЛОНИТЬ тикет (админ)
        if (interaction.isButton() && interaction.customId.startsWith("ticket_decline_")) {
            const ticketId = interaction.customId.split("_")[2];
            await handleDeclineTicket(interaction, ticketId);
            return;
        }

        // 🔹 1. Выбор категории из селекта
        if (interaction.isStringSelectMenu() && interaction.customId === "ticket_category_select") {
            const categoryId = interaction.values[0];
            const category = TICKET_CATEGORIES.find(c => c.id === categoryId);
            
            if (!category) {
                return await interaction.reply({ content: "❌ Категория не найдена!", flags: 64 });
            }

            await showCategoryFields(interaction, category);
            return;
        }

        // 🔹 2. Пользователь заполнил поля → создаём тикет
        if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_fields_")) {
            const categoryId = interaction.customId.split("_")[2];
            const category = TICKET_CATEGORIES.find(c => c.id === categoryId);
            if (!category) return await interaction.reply({ content: "❌ Категория не найдена!", flags: 64 });

            const formData: Record<string, any> = {};
            for (const field of category.fields) {
                try {
                    formData[field.name] = interaction.fields.getTextInputValue(field.name);
                } catch {
                    // Поле необязательное или пустое
                }
            }

            // Обработка упоминания пользователя
            if (formData.targetUser) {
                const match = formData.targetUser.match(/<@!?(\d+)>/);
                if (match) {
                    formData.targetUser = await interaction.client.users.fetch(match[1]);
                }
            }

            const { ticketId, channel } = await createTicket(
                interaction.user,
                interaction.guild!,
                category,
                formData
            );

            await interaction.reply({ 
                content: `✅ Тикет создан: <#${channel.id}>`, 
                flags: 64 
            });
            return;
        }

// 🔹 3. Причина отклонения
if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_decline_reason_")) {
    try {
        await interaction.deferReply({ flags: 64 }).catch(() => {});

        const ticketId = interaction.customId.split("_")[3];
        const reason = interaction.fields.getTextInputValue("reason");
        
        db.prepare(`UPDATE tickets SET status = 'declined', declinedReason = ?, updatedAt = ? WHERE ticketId = ?`)
          .run(reason, new Date().toISOString(), ticketId);

        const ticket = db.prepare("SELECT * FROM tickets WHERE ticketId = ?").get(ticketId) as any;
        if (ticket?.channelId) {
            const ch = await interaction.guild?.channels.fetch(ticket.channelId).catch(() => null);
            if (ch?.isTextBased()) {
                await ch.send(`❌ Ваш тикет отклонён. Причина: ${reason}`).catch(() => {});
            }
        }

        await closeAndArchiveTicket(
            ticketId, 
            interaction.user, 
            reason, 
            undefined, 
            undefined,
            null,
            'declined'
        );
        
        await deleteActiveTicketMessage(interaction.guild!, ticketId).catch(() => {});

        // ✅ Ответ с защитой от "Unknown Message"
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ 
                content: "✅ Тикет отклонён и отправлен в архив" 
            }).catch((err) => {
                if (err.code !== 10008) {
                    console.warn("⚠️ Не удалось обновить ответ:", err.message);
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Ошибка отклонения:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: "❌ Произошла ошибка при обработке", 
                flags: 64 
            }).catch(() => {});
        } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ 
                content: "❌ Произошла ошибка при обработке" 
            }).catch(() => {});
        }
    }
    return;
}

// 🔹 4. Закрытие тикета
if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_close_")) {
    try {
        // ✅ 1. deferReply с catch
        await interaction.deferReply({ flags: 64 }).catch(() => {});

        const ticketId = interaction.customId.split("_")[2];
        const reason = interaction.fields.getTextInputValue("close_reason");
        
        // ✅ 2. Безопасно получаем оценку
        let rating: number | undefined;
        try {
            const ratingStr = interaction.fields.getTextInputValue("close_rating");
            if (ratingStr) {
                const num = parseInt(ratingStr, 10);
                if (!isNaN(num)) {
                    rating = Math.min(Math.max(num, 1), 5);
                }
            }
        } catch {
            rating = undefined; // Поле может отсутствовать
        }
        
        let comment: string | undefined;
            try {
                comment = interaction.fields.getTextInputValue("close_comment") || undefined;
            } catch {
                comment = undefined; // Поля нет — нормальная ситуация для модератора
            }

        // ✅ 3. Закрываем тикет
        await closeAndArchiveTicket(
            ticketId, 
            interaction.user, 
            reason, 
            rating, 
            comment, 
            null,
            'closed'
        );

        // ✅ 4. ОТВЕТ с максимальной защитой
        // Канал уже удалён, поэтому editReply может упасть — это НОРМАЛЬНО
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ 
                content: "✅ Тикет закрыт и отправлен в архив" 
            }).catch((err) => {
                // ❗ Игнорируем ошибки "неизвестное сообщение" — тикет уже закрыт
                if (err.code !== 10008) {
                    console.warn("⚠️ Не удалось обновить ответ:", err.message);
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Ошибка закрытия:", error);
        
        // ✅ 5. Безопасный ответ в случае ошибки
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ 
                content: "❌ Произошла ошибка при обработке", 
                flags: 64 
            }).catch(() => {});
        } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ 
                content: "❌ Произошла ошибка при обработке" 
            }).catch(() => {});
        }
    }
    return;
}

// 🔹 Функция ПРИНЯТИЯ тикета (админ)
async function handleAcceptTicket(interaction: ButtonInteraction, ticketId: string) {
    try {
        // ✅ 1. СРАЗУ отвечаем, что начали обработку (даёт +15 сек)
        await interaction.deferReply({ flags: 64 }).catch(() => {});

        const ticket = db.prepare("SELECT * FROM tickets WHERE ticketId = ?").get(ticketId) as any;
        
        if (!ticket) {
            return await interaction.reply({ content: "❌ Тикет не найден", flags: 64 });
        }

        // Обновляем статус в БД
        db.prepare(`
            UPDATE tickets SET status = 'accepted', acceptedBy = ?, updatedAt = ? WHERE ticketId = ?
        `).run(interaction.user.id, new Date().toISOString(), ticketId);

        // Уведомляем пользователя в приватном канале
        const channel = await interaction.guild?.channels.fetch(ticket.channelId) as TextChannel;
        if (channel) {
            // Обновляем первое сообщение (статус)
            const messages = await channel.messages.fetch({ limit: 1 });
            const firstMsg = messages.first();
            if (firstMsg?.embeds[0]) {
                const updatedEmbed = EmbedBuilder.from(firstMsg.embeds[0])
                    .setColor(0x00FF00)
                    .setFooter({ text: `✅ Принят модератором ${interaction.user.tag}` });
                await firstMsg.edit({ embeds: [updatedEmbed] });
            }
            await channel.send(`✅ <@${ticket.userId}>, ваш тикет принят модератором <@${interaction.user.id}>! Напишите, чем можем помочь.`);
        }

        // Обновляем сообщение в канале активных тикетов
        await updateActiveTicketMessage(interaction.guild!, ticketId, 'accepted', interaction.user);

        // ✅ 2. ОТВЕЧАЕМ с проверкой + catch
        if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ 
                content: `✅ Тикет принят! Перейдите в <#${ticket.channelId}>` 
            }).catch(() => {});
        }

    } catch (error) {
        console.error("❌ Ошибка при принятии тикета:", error);

                // ✅ 3. Безопасный ответ в случае ошибки
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Ошибка при обработке", flags: 64 }).catch(() => {});
        } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content: "❌ Ошибка при обработке" }).catch(() => {});
        }
    }
}

// 🔹 Функция ОТКЛОНЕНИЯ тикета (админ)
async function handleDeclineTicket(interaction: ButtonInteraction, ticketId: string) {
    try {
        // Показываем модалку для ввода причины
        const modal = new ModalBuilder()
            .setCustomId(`ticket_decline_reason_${ticketId}`)
            .setTitle('❌ Отклонить тикет')
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel('Причина отклонения')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('Например: Нарушение правил, дубликат...')
                        .setRequired(true)
                        .setMaxLength(200)
                )
            );

        await interaction.showModal(modal).catch(() => {});

    } catch (error) {
        console.error("❌ Ошибка при отклонении тикета:", error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: "❌ Ошибка при обработке", flags: 64 }).catch(() => {});
        } else if (interaction.deferred && !interaction.replied) {
            await interaction.editReply({ content: "❌ Ошибка при обработке" }).catch(() => {});
        }
    }
}

// 🔹 Обновление сообщения в канале активных тикетов
async function updateActiveTicketMessage(
    guild: Guild,
    ticketId: string,
    status: string,
    moderator?: User
) {
    try {
        const settings = getTicketSettings(guild.id);
        if (!settings?.activeTicketsChannelId) return;

        const channel = await guild.channels.fetch(settings.activeTicketsChannelId) as TextChannel;
        if (!channel) return;

        // Находим сообщение по футеру (там хранится часть ticketId)
        const messages = await channel.messages.fetch({ limit: 50 });
        const ticketMessage = messages.find(m => 
            m.embeds[0]?.footer?.text?.includes(ticketId.slice(0, 8))
        );

        if (!ticketMessage) return;

        const embed = ticketMessage.embeds[0];
        const newEmbed = EmbedBuilder.from(embed)
            .setColor(status === 'accepted' ? 0x00FF00 : 0xFF0000)
            .setFooter({ 
                text: `Статус: ${status === 'accepted' ? '✅ Принят' : '❌ Отклонён'} | ${ticketId.slice(0, 8)}...` 
            });

        if (status === 'accepted' && moderator) {
            newEmbed.addFields({ name: '👮 Принят', value: `<@${moderator.id}>`, inline: true });
        }

        // Убираем кнопки если принят
        const components = status === 'accepted' ? [] : ticketMessage.components;

        await ticketMessage.edit({ embeds: [newEmbed], components });

    } catch (error) {
        console.error("❌ Ошибка обновления сообщения:", error);
    }
}

// 🔹 Вспомогательная функция показа полей категории
async function showCategoryFields(
    interaction: StringSelectMenuInteraction,
    category: any
) {
    const modal = new ModalBuilder()
        .setCustomId(`ticket_fields_${category.id}`)
        .setTitle(category.name);

    for (const field of category.fields) {
        const isParagraph = field.type === 'textarea';
        const label = field.name.charAt(0).toUpperCase() + field.name.slice(1);
        
        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId(field.name)
                    .setLabel(label)
                    .setStyle(isParagraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
                    .setPlaceholder(field.placeholder || '')
                    .setRequired(field.required)
                    .setMaxLength(isParagraph ? 1000 : 100)
            )
        );
    }

    await interaction.showModal(modal);
}
}
