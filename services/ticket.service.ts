import { 
    Guild, TextChannel, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, PermissionFlagsBits, OverwriteType, User, 
    GuildMember, Message, ButtonInteraction, ChatInputCommandInteraction, 
    TextInputStyle
} from "discord.js";
import { db } from "../database/database";
import { TICKET_CATEGORIES, TicketCategory } from "../config/ticket_categories";
import { v4 as uuidv4 } from 'uuid'; // npm install uuid @types/uuid

// ==================== НАСТРОЙКИ ====================

export async function setupTicketSystem(
    guild: Guild, 
    ticketChannelId: string, 
    activeChannelId: string, 
    archiveChannelId: string,
    categoryId: string
) {
    db.prepare(`
        INSERT INTO ticket_settings (guildId, ticketChannelId, activeTicketsChannelId, archiveChannelId, ticketCategoryId)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(guildId) DO UPDATE SET 
            ticketChannelId = excluded.ticketChannelId,
            activeTicketsChannelId = excluded.activeTicketsChannelId,
            archiveChannelId = excluded.archiveChannelId,
            ticketCategoryId = excluded.ticketCategoryId
    `).run(guild.id, ticketChannelId, activeChannelId, archiveChannelId, categoryId);
}

export function getTicketSettings(guildId: string) {
    return db.prepare("SELECT * FROM ticket_settings WHERE guildId = ?").get(guildId) as any;
}

// ==================== СОЗДАНИЕ ТИКЕТА ====================

export async function createTicket(
    user: User,
    guild: Guild,
    category: TicketCategory,
    formData: Record<string, any>
) {
    const settings = getTicketSettings(guild.id);
    if (!settings) throw new Error("Тикет-система не настроена");

    const ticketId = uuidv4();
    const channelName = `ticket-${user.username}-${ticketId.slice(0, 4)}`;

    // Создаём приватный канал
    const categoryObj = await guild.channels.fetch(settings.ticketCategoryId);
    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: categoryObj?.id,
        permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
            { id: guild.roles.cache.find(r => r.permissions.has(PermissionFlagsBits.ManageMessages))?.id || '', allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ],
        reason: `Тикет от ${user.tag}`
    }) as TextChannel;

    // Сохраняем тикет в БД
    const ticketData: any = {
        ticketId,
        guildId: guild.id,
        channelId: channel.id,
        userId: user.id,
        category: category.id,
        reason: formData.reason || formData.description || formData.comment || '',
        createdAt: new Date().toISOString()
    };

    // Дополнительные поля в зависимости от категории
    if (category.id === 'report' && formData.targetUser) {
        ticketData.targetUserId = formData.targetUser.id;
    }
    if (category.id === 'suggestion' && formData.title) {
        ticketData.title = formData.title;
    }
    if (formData.comment) {
        ticketData.comment = formData.comment;
    }

    db.prepare(`
        INSERT INTO tickets (ticketId, guildId, channelId, userId, category, status, title, targetUserId, reason, comment, createdAt)
        VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)
    `).run(
        ticketId, guild.id, channel.id, user.id, category.id,
        ticketData.title || null, ticketData.targetUserId || null, 
        ticketData.reason, ticketData.comment || null, ticketData.createdAt
    );

    // ✅ Для user-полей нужно получить упомянутого пользователя
    let targetUserId: string | null = null;

    if (formData.targetUser) {
        const mentionMatch = formData.targetUser.match(/<@!?(\d+)>/);
        if (mentionMatch) {
            targetUserId = mentionMatch[1];
        }
        else if (typeof formData.targetUser === 'string' && /^\d+$/.test(formData.targetUser)) {
            targetUserId = formData.targetUser;
        }

        if (targetUserId) {
            ticketData.targetUserId = targetUserId;
            
            try {
                const targetUser = await guild.members.fetch(targetUserId);
                formData.targetUser = targetUser; // Заменяем строку на объект пользователя для дальнейшего использования
            } catch (error) {
                console.error("Не удалось получить пользователя: ", targetUserId);
                formData.targetUser = null; // Если пользователь не найден, сбрасываем поле 
            }
        }
    }

    // Отправляем embed в приватный канал
    const statusEmbed = createTicketStatusEmbed(ticketId, user, category, formData, 'pending');

        // ✅ ВСТАВЬТЕ СЮДА (ПОСЛЕ создания embed, ПЕРЕД отправкой)
    if (category.id === 'report' && formData.targetUser) {
        statusEmbed.addFields({
            name: '🎯 Нарушитель',
            value: `<@${formData.targetUser.id}>`,
            inline: true
        });
    }

    // После отправки embed в приватный канал
    await channel.send({ 
        embeds: [statusEmbed],
        components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`ticket_close_button_${ticketId}_${user.id}`)
                    .setLabel('🔒 Закрыть тикет')
                    .setStyle(ButtonStyle.Danger)
            )
        ]
    });

    await channel.send({
        content: `👋 Здравствуйте, <@${user.id}>! Ваш тикет создан. Ожидайте ответа модератора.`,
    });

    // Отправляем уведомление в канал активных тикетов
    await notifyActiveTickets(guild, ticketId, user, category, formData);

    return { ticketId, channel };
}

// ==================== EMBED СООБЩЕНИЯ ====================

export function createTicketStatusEmbed(
    ticketId: string,
    user: User,
    category: TicketCategory,
    formData: Record<string, any>,
    status: string,
    moderator?: User,
    declinedReason?: string
) {
    const statusColors: Record<string, number> = {
        pending: 0xFFA500,    // Orange
        accepted: 0x00FF00,   // Green
        declined: 0xFF0000,   // Red
        closed: 0x808080      // Gray
    };

    const statusLabels: Record<string, string> = {
        pending: '⏳ Ожидает рассмотрения',
        accepted: '✅ Принят модератором',
        declined: '❌ Отклонён',
        closed: '🔒 Закрыт'
    };

    const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name}`)
        .setColor(statusColors[status] || 0xFFA500)
        .addFields(
            { name: '🆔 ID тикета', value: `\`${ticketId.slice(0, 8)}...\``, inline: true },
            { name: '👤 Автор', value: `<@${user.id}>`, inline: true },
            { name: '📊 Статус', value: statusLabels[status], inline: true }
        )
        .setTimestamp();

    // Добавляем поля в зависимости от категории
    if (category.id === 'report') {
        if (formData.targetUser) {
            embed.addFields({ name: '🎯 На пользователя', value: `<@${formData.targetUser.id}>`, inline: true });
        }
        if (formData.reason) {
            embed.addFields({ name: '📋 Причина', value: getReasonLabel(formData.reason), inline: false });
        }
    }
    if (category.id === 'suggestion' && formData.title) {
        embed.addFields({ name: '📌 Заголовок', value: formData.title, inline: false });
    }
    if (formData.description || formData.comment) {
        embed.addFields({ name: '📝 Описание', value: (formData.description || formData.comment || '').slice(0, 1000), inline: false });
    }
    if (status === 'accepted' && moderator) {
        embed.addFields({ name: '👮 Принят модератором', value: `<@${moderator.id}>`, inline: true });
    }
    if (status === 'declined' && declinedReason) {
        embed.addFields({ name: '❌ Причина отклонения', value: declinedReason, inline: false });
    }

    return embed;
}

function getReasonLabel(value: string): string {
    const labels: Record<string, string> = {
        spam: '📧 Спам',
        insult: '😤 Оскорбления',
        flood: '💬 Флуд',
        behavior: '🎭 Неадекватное поведение',
        other: '📦 Другое'
    };
    return labels[value] || value;
}

// ==================== УВЕДОМЛЕНИЕ В АКТИВНЫЕ ТИКЕТЫ ====================

export async function notifyActiveTickets(
    guild: Guild,
    ticketId: string,
    user: User,
    category: TicketCategory,
    formData: Record<string, any>
) {
    const settings = getTicketSettings(guild.id);
    if (!settings?.activeTicketsChannelId) return;

    const channel = await guild.channels.fetch(settings.activeTicketsChannelId) as TextChannel;
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle(`🎫 Новый тикет: ${category.name}`)
        .setColor(0xFFA500)
        .addFields(
            { name: '👤 Автор', value: `<@${user.id}>`, inline: true },
            { name: '🆔 Тикет', value: `\`${ticketId.slice(0, 8)}...\``, inline: true },
            { name: '📋 Кратко', value: (formData.reason || formData.description || 'Без описания').slice(0, 100), inline: false }
        )
        .setFooter({ text: `ID: ${ticketId.slice(0, 8)}...` })
        .setTimestamp();

    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`ticket_accept_${ticketId}`)
            .setLabel('✅ Принять')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`ticket_decline_${ticketId}`)
            .setLabel('❌ Отклонить')
            .setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `<@&1503696150253797416>`, embeds: [embed], components: [actionRow] });
    
    // Сохраняем ID сообщения для обновления
    db.prepare("UPDATE tickets SET updatedAt = ? WHERE ticketId = ?").run(new Date().toISOString(), ticketId);
}

// ==================== ОБРАБОТКА КНОПОК ====================

export async function handleTicketButton(interaction: ButtonInteraction) {
    const [action, ticketId] = interaction.customId.split('_').slice(1);
    
    const ticket = db.prepare("SELECT * FROM tickets WHERE ticketId = ?").get(ticketId) as any;
    if (!ticket) {
        return interaction.reply({ content: "❌ Тикет не найден", flags: 64 });
    }

    const guild = interaction.guild;
    if (!guild) return;

    const channel = await guild.channels.fetch(ticket.channelId) as TextChannel;
    const user = await interaction.client.users.fetch(ticket.userId);

    switch (action) {
        case 'accept':
            return await handleAcceptTicket(interaction, ticket, channel, user, guild);
        case 'decline':
            return await handleDeclineTicket(interaction, ticket, channel, user, guild);
        case 'close':
            return await handleCloseTicket(interaction, ticket, channel, user, guild);
    }
}

async function handleAcceptTicket(
    interaction: ButtonInteraction,
    ticket: any,
    channel: TextChannel,
    user: User,
    guild: Guild
) {
    const moderator = interaction.user;

    // Обновляем статус в БД
    db.prepare(`
        UPDATE tickets SET 
        status = 'accepted', 
        acceptedBy = ?, 
        updatedAt = ? 
        WHERE ticketId = ?
    `).run(interaction.user.id, new Date().toISOString(), ticket.ticketId);

    // Обновляем embed в приватном канале
    const category = TICKET_CATEGORIES.find(c => c.id === ticket.category);
    const formData = { reason: ticket.reason, description: ticket.comment, title: ticket.title };
    const updatedEmbed = createTicketStatusEmbed(ticket.ticketId, user, category!, formData, 'accepted', moderator);
    
    // Находим и редактируем первое сообщение (статус)
    const messages = await channel.messages.fetch({ limit: 1 });
    const statusMessage = messages.first();
    if (statusMessage) {
        await statusMessage.edit({ embeds: [updatedEmbed] });
    }

    // Уведомляем пользователя
    await channel.send(`👋 <@${user.id}>, ваш тикет принят модератором <@${moderator.id}>! Напишите, чем мы можем помочь.`);

    // Обновляем сообщение в активных тикетах
    await updateActiveTicketMessage(guild, ticket.ticketId, 'accepted', moderator);

    await interaction.reply({ content: `✅ Тикет принят. Вы перенаправлены в <#${channel.id}>`, flags: 64 });
}

async function handleDeclineTicket(
    interaction: ButtonInteraction,
    ticket: any,
    channel: TextChannel,
    user: User,
    guild: Guild
) {
    // Модальное окно для причины отклонения
    if (!interaction.isButton()) return;
    
    await interaction.showModal({
        customId: `ticket_decline_reason_${ticket.ticketId}`,
        title: 'Причина отклонения',
        components: [{
            type: 1,
            components: [{
                type: 4,
                customId: 'reason',
                label: 'Почему отклоняете?',
                style: TextInputStyle.Paragraph,
                required: true,
                maxLength: 200
            }]
        }]
    });
}

async function handleCloseTicket(
    interaction: ButtonInteraction,
    ticket: any,
    channel: TextChannel,
    user: User,
    guild: Guild
) {
    // Показать модальное окно с причинами закрытия и оценкой
    await interaction.showModal({
        customId: `ticket_close_${ticket.ticketId}`,
        title: 'Закрыть тикет',
        components: [
            {
                type: 1,
                components: [{
                    type: 4,
                    customId: 'close_reason',
                    label: 'Причина закрытия',
                    style: 1,
                    placeholder: 'Например: "Решено"',
                    required: true
                }]
            },
            {
                type: 1,
                components: [{
                    type: 4,
                    customId: 'close_comment',
                    label: 'Комментарий (необязательно)',
                    style: 2,
                    required: false,
                    maxLength: 200
                }]
            }
        ]
    });
}

// ==================== ОБНОВЛЕНИЕ СООБЩЕНИЯ В АКТИВНЫХ ====================

async function updateActiveTicketMessage(
    guild: Guild,
    ticketId: string,
    status: string,
    moderator?: User
) {
    const settings = getTicketSettings(guild.id);
    if (!settings?.activeTicketsChannelId) return;

    const channel = await guild.channels.fetch(settings.activeTicketsChannelId) as TextChannel;
    if (!channel) return;

    // Находим сообщение с тикетом (поиск по embed)
    const messages = await channel.messages.fetch({ limit: 50 });
    const ticketMessage = messages.find(m => 
        m.embeds[0]?.footer?.text?.includes(ticketId.slice(0, 8))
    );

    if (!ticketMessage) return;

    const embed = ticketMessage.embeds[0];
    const newEmbed = EmbedBuilder.from(embed)
        .setColor(status === 'accepted' ? 0x00FF00 : 0xFF0000)
        .setFooter({ text: `Статус: ${status === 'accepted' ? '✅ Принят' : '❌ Отклонён'} | ${ticketId.slice(0, 8)}...` });

    if (status === 'accepted' && moderator) {
        newEmbed.addFields({ name: '👮 Принят', value: `<@${moderator.id}>`, inline: true });
    }

    // Убираем кнопки если принят
    const components = status === 'accepted' ? [] : ticketMessage.components;

    await ticketMessage.edit({ embeds: [newEmbed], components });
}

// ==================== ЗАКРЫТИЕ И АРХИВАЦИЯ ====================

export async function closeAndArchiveTicket(
    ticketId: string,
    closedBy: User,
    reason: string,
    rating?: number,
    comment?: string,
    interaction?: any,
    status: 'closed' | 'declined' = 'closed',
) {
    const ticket = db.prepare("SELECT * FROM tickets WHERE ticketId = ?").get(ticketId) as any;
    if (!ticket) return;

        // ✅ Если тикет не был принят модератором — игнорируем оценку
    if (!ticket.acceptedBy && rating) {
        console.log(`⚠️ Тикет ${ticketId} не был принят модератором, оценка проигнорирована`);
        rating = undefined; // ✅ Сбрасываем оценку
    }

    const guild = await closedBy.client.guilds.fetch(ticket.guildId);
    const channel = await guild.channels.fetch(ticket.channelId) as TextChannel;
    const user = await closedBy.client.users.fetch(ticket.userId);
    const category = TICKET_CATEGORIES.find(c => c.id === ticket.category);

    // ✅ Генерируем транскрипт (если канал ещё существует)
    let transcript = "📋 ТРАНСКРИПТ НЕ ДОСТУПЕН (канал удалён)\n";
    if (channel) {
        transcript = await generateTranscript(channel, ticket);
    }

    // 2. Обновляем статус в БД
    db.prepare(`
        UPDATE tickets SET 
            status = ?, 
            closedBy = ?, 
            closedReason = ?, 
            rating = ?, 
            closedAt = ? 
        WHERE ticketId = ?
    `).run(status, closedBy.id, reason, rating || null, new Date().toISOString(), ticketId);

    // 3. Сохраняем оценку если есть
    if (rating && ticket.acceptedBy) {
        db.prepare(`
            INSERT INTO ticket_ratings (ticketId, moderatorId, rating, comment, createdAt)
            VALUES (?, ?, ?, ?, ?)
        `).run(ticketId, ticket.acceptedBy, rating, comment ?? null, new Date().toISOString());
    }

    // 4. Отправляем в архив
    await sendToArchive(guild, ticket, user, category!, transcript, closedBy, reason, rating, status);

        if (channel) {
        const message = status === 'declined' 
            ? `❌ Ваш тикет был **отклонён** ${closedBy.toString()}. Причина: ${reason}`
            : `✅ Ваш тикет был **закрыт** ${closedBy.toString()}. Причина: ${reason}`;
        
        try {
            await channel.send(message);
        } catch (e) {
            console.log("⚠️ Не удалось отправить сообщение в канал тикета");
        }
    }

// ✅ СНАЧАЛА отвечаем на взаимодействие
    if (interaction && !interaction.replied && !interaction.deferred) {
        try {
            const replyMsg = status === 'declined' 
                ? "✅ Тикет отклонён ${closedBy.toString()} и отправлен в архив" 
                : "✅ Тикет закрыт ${closedBy.toString()} и отправлен в архив";
            
            await interaction.reply({ 
                content: replyMsg, 
                flags: 64 
            });
        } catch (e) {
            console.log("⚠️ Не удалось ответить на взаимодействие");
        }
    }

    // ✅ ПОТОМ удаляем приватный канал (если существует)
    if (channel) {
        await channel.delete().catch(() => {});
    }

    // ✅ Удаляем сообщение из активных тикетов
    await deleteActiveTicketMessage(guild, ticketId);
}

async function generateTranscript(channel: TextChannel, ticket: any): Promise<string> {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted = messages.reverse();

    let transcript = `📋 ТРАНСКРИПТ ТИКЕТА #${ticket.ticketId.slice(0, 8)}\n`;
    transcript += `👤 Автор: <@${ticket.userId}>\n`;
    transcript += `📂 Категория: ${ticket.category}\n`;
    transcript += `📅 Создан: <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:F>\n\n`;
    transcript += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const msg of sorted.values()) {
        if (msg.system) continue;
        const timestamp = `<t:${Math.floor(msg.createdTimestamp / 1000)}:T>`;
        const author = msg.author?.tag || 'Unknown';
        const content = msg.content || (msg.attachments.size > 0 ? '[Вложение]' : '');
        transcript += `[${timestamp}] ${author}: ${content}\n`;
    }

    return transcript;
}

async function sendToArchive(
    guild: Guild,
    ticket: any,
    user: User,
    category: TicketCategory,
    transcript: string,
    closedBy: User,
    reason: string,
    rating?: number,
    status: 'closed' | 'declined' = 'closed',
) {
    const settings = getTicketSettings(guild.id);
    if (!settings?.archiveChannelId) return;

    const channel = await guild.channels.fetch(settings.archiveChannelId) as TextChannel;
    if (!channel) return;

    const isDeclined = status === 'declined';
    const embed = new EmbedBuilder()
        .setTitle(`${isDeclined ? '❌ Отклонён' : '🗄️ Архив'}: ${category.name}`)
        .setColor(isDeclined ? 0xFF0000 : 0x808080)  // Красный для отклонённых, серый для закрытых
        
        .addFields(
            { name: '🆔 Тикет', value: `\`${ticket.ticketId}\``, inline: true },
            { name: '👤 Автор', value: `<@${ticket.userId}>`, inline: true },
            { name: '👮 Закрыл', value: `<@${closedBy.id}>`, inline: true },
            { name: '📋 Причина', value: reason, inline: false },
            { name: '⭐ Оценка', value: rating ? '⭐'.repeat(rating) + ` (${rating}/5)` : 'Не поставлена', inline: true },
            { name: '📊 Статус', value: isDeclined ? '❌ Отклонён' : '✅ Закрыт', inline: true }
        )
        .setTimestamp();
        // ✅ Показываем кто принял
    if (ticket.acceptedBy) {
        embed.addFields({ 
            name: '👮 Принял', 
            value: `<@${ticket.acceptedBy}>`, 
            inline: true 
        });
    }
    await channel.send({ 
        embeds: [embed], 
        files: [{ attachment: Buffer.from(transcript), name: `transcript-${ticket.ticketId.slice(0, 8)}.txt` }] 
    });
}

export async function deleteActiveTicketMessage(guild: Guild, ticketId: string) {
    const settings = getTicketSettings(guild.id);
    if (!settings?.activeTicketsChannelId) return;

    const channel = await guild.channels.fetch(settings.activeTicketsChannelId) as TextChannel;
    if (!channel) return;

    const messages = await channel.messages.fetch({ limit: 50 });
    const ticketMessage = messages.find(m => 
        m.embeds[0]?.footer?.text?.includes(ticketId.slice(0, 8))
    );

    if (ticketMessage) {
        await ticketMessage.delete();
    }
}