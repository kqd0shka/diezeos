import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { InventoryService } from "../services/inventory.service";

export const shop = {
    data: new SlashCommandBuilder()
        .setName("shop")
        .setDescription("Посмотреть роли на продаже")
        .addIntegerOption(opt => opt.setName("page").setDescription("Страница").setMinValue(1).setMaxValue(10)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const page = interaction.options.getInteger("page") || 1;
        const items = InventoryService.getShopItems(interaction.guild.id, 25);
        
        if (items.length === 0) {
            return interaction.reply({ content: "🛒 Магазин пуст. Будьте первым продавцом! `/sellrole`", flags: 64 });
        }

        const embed = new EmbedBuilder()
            .setTitle("🛒 Магазин личных ролей")
            .setColor(0xf1c40f)
            .setFooter({ text: `Страница ${page} | Комиссия сервера: 10%` });

        items.slice((page - 1) * 10, page * 10).forEach((item: any, i: number) => {
            embed.addFields({
                name: `${(page - 1) * 10 + i + 1}. ${item.itemName}`,
                value: `🎨 #${item.itemColor?.toString(16).padStart(6, '0').toUpperCase()}\n👤 Продавец: ${item.sellerName || 'Unknown'}\n💰 Цена: **${item.listedPrice}** 🪙\n🆔 \`/buyrole ${item.itemId} ${item.listedPrice}\``,
                inline: true
            });
        });

        await interaction.reply({ embeds: [embed], flags: 64 });
    }
};