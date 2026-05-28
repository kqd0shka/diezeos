import { 
    ChatInputCommandInteraction, SlashCommandBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    User, GuildMember, EmbedBuilder, PermissionFlagsBits
} from "discord.js";
import { TICKET_CATEGORIES } from "../config/ticket_categories";

export const ticket = {
    data: new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Создать тикет для связи с администрацией")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(cmd => 
            cmd.setName("create").setDescription("Создать новый тикет")
        )
        .addSubcommand(cmd => 
            cmd.setName("setup").setDescription("Настроить тикет-систему (только админ)")
                .addChannelOption(opt => opt.setName("panel").setDescription("Канал с панелью создания").setRequired(true))
                .addChannelOption(opt => opt.setName("active").setDescription("Канал для активных тикетов").setRequired(true))
                .addChannelOption(opt => opt.setName("archive").setDescription("Канал-архив").setRequired(true))
                .addChannelOption(opt => opt.setName("category").setDescription("Категория для тикетов").setRequired(true))
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "setup") {
            return await handleSetup(interaction);
        }

        return await handleCreate(interaction);
    }
};

async function handleSetup(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    
    if (!member.permissions.has("ManageGuild")) {
        return interaction.reply({ content: "❌ Только администраторы могут настраивать тикет-систему", flags: 64 });
    }

    const panel = interaction.options.getChannel("panel", true);
    const active = interaction.options.getChannel("active", true);
    const archive = interaction.options.getChannel("archive", true);
    const category = interaction.options.getChannel("category", true);

    const { setupTicketSystem } = await import("../services/ticket.service");
    
    await setupTicketSystem(
        interaction.guild!,
        panel.id,
        active.id,
        archive.id,
        category.id
    );

    // Отправляем панель с инструкцией
    const embed = {
        title: "🎫 Создать тикет",
        description: "Нажмите на кнопку ниже, чтобы создать тикет для связи с администрацией.\n\n**Доступные категории:**\n" + 
            TICKET_CATEGORIES.map(c => `${c.emoji} **${c.name}** — ${c.description}`).join("\n"),
        color: 0x3498db
    };

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("ticket_category_select")
                .setPlaceholder("Выберите категорию тикета")
                .addOptions(TICKET_CATEGORIES.map(cat => ({
                    label: cat.name,
                    description: cat.description,
                    value: cat.id,
                    emoji: cat.emoji
                })))
        );

    await (panel as any).send({ embeds: [embed], components: [row] });

    return interaction.reply({ content: "✅ Тикет-система настроена! Панель отправлена.", flags: 64 });
}

async function handleCreate(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
        .setTitle("🎫 Создание тикета")
        .setDescription("Выберите категорию тикета:")
        .setColor(0x3498db)
        .addFields(
            TICKET_CATEGORIES.map(cat => ({
                name: `${cat.emoji} ${cat.name}`,
                value: cat.description,
                inline: false
            }))
        );

    const select = new StringSelectMenuBuilder()
        .setCustomId("ticket_category_select")
        .setPlaceholder("Выберите категорию...")
        .addOptions(TICKET_CATEGORIES.map(cat => ({
            label: cat.name.replace(/[^a-zA-Z0-9\u0400-\u04FF\s]/g, '').slice(0, 25), // Discord требует только текст в label
            description: cat.description.slice(0, 50),
            value: cat.id,
            emoji: cat.emoji
        })));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>()
        .addComponents(select);

    await interaction.reply({ 
        embeds: [embed], 
        components: [row], 
        flags: 64 
    });
}