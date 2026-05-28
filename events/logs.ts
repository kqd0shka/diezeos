import { Client, EmbedBuilder } from "discord.js";
import { sendLog } from "../services/logs.service";

export function setupLogging(client: Client) {
    
    // 1. УДАЛЕНИЕ СООБЩЕНИЯ
    client.on("messageDelete", async (message) => {
        if (!message.guild || message.author?.bot) return; // Игнорируем ботов и ЛС

        const embed = new EmbedBuilder()
            .setColor("Red")
            .setTitle("🗑️ Сообщение удалено")
            .addFields(
                { name: "Автор", value: `<@${message.author?.id}>`, inline: true },
                { name: "Канал", value: `<#${message.channelId}>`, inline: true },
                { name: "Содержимое", value: message.content ? message.content.substring(0, 1000) : "*Вложение / Empty*" }
            )
            .setFooter({ text: `ID: ${message.id}` })
            .setTimestamp();

        await sendLog(message.guild, embed);
    });

    // 2. РЕДАКТИРОВАНИЕ СООБЩЕНИЯ
    client.on("messageUpdate", async (oldMessage, newMessage) => {
        // Проверяем, что сообщение изменилось по тексту, и это не бот
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        const embed = new EmbedBuilder()
            .setColor("Orange")
            .setTitle("✏️ Сообщение отредактировано")
            .addFields(
                { name: "Автор", value: `<@${newMessage.author?.id}>`, inline: true },
                { name: "Канал", value: `<#${newMessage.channelId}>`, inline: true },
                { name: "Старое", value: oldMessage.content ? oldMessage.content.substring(0, 500) : "*Empty*", inline: false },
                { name: "Новое", value: newMessage.content ? newMessage.content.substring(0, 500) : "*Empty*", inline: false },
                { name: "Ссылка", value: `[Перейти к сообщению](${newMessage.url})`, inline: false }
            )
            .setTimestamp();

        await sendLog(newMessage.guild, embed);
    });

    // 3. ВХОД / ВЫХОД УЧАСТНИКОВ
    client.on("guildMemberRemove", async (member) => {
        const embed = new EmbedBuilder()
            .setColor("Purple")
            .setTitle("👋 Участник покинул сервер")
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: "Пользователь", value: `${member.user.tag} (${member.id})`, inline: true },
                { name: "Дата аккаунта", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: "Дата входа", value: member.joinedTimestamp ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Неизвестно", inline: true }
            )
            .setTimestamp();

        await sendLog(member.guild, embed);
    });
}