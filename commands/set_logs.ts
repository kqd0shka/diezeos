import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction, ChannelType } from "discord.js";
import { db } from "../database/database";

export const set_logs = {
    data: new SlashCommandBuilder()
        .setName("set_logs")
        .setDescription("Настроить канал для логов сервера")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName("channel")
                .setDescription("Канал, куда будут падать логи")
                .setRequired(true)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const channel = interaction.options.getChannel("channel", true);
        
        if (channel.type != ChannelType.GuildText && channel.type != ChannelType.GuildAnnouncement) {
            return interaction.reply({ content: "❌ Выберите текстовый канал!", flags: 64 });
        }

        // Сохраняем в БД
        db.prepare(`
            INSERT INTO guild_settings (guildId, logChannelId) VALUES (?, ?)
            ON CONFLICT(guildId) DO UPDATE SET logChannelId = ?
        `).run(interaction.guildId, channel.id, channel.id);

        return interaction.reply({ 
            content: `✅ Логи сервера будут отправляться в <#${channel.id}>`, 
            flags: 64 
        });
    }
};