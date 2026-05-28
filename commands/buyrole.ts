import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { InventoryService } from "../services/inventory.service";

export const buyrole = {
    data: new SlashCommandBuilder()
        .setName("buyrole")
        .setDescription("Купить роль из магазина")
        .addStringOption(opt => opt.setName("role_id").setDescription("ID роли").setRequired(true))
        .addIntegerOption(opt => opt.setName("price").setDescription("Подтвердите цену").setRequired(true)),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const roleId = interaction.options.getString("role_id", true);
        const price = interaction.options.getInteger("price", true);

        await interaction.deferReply({ flags: 64 });

        // Находим продавца
        const listing = InventoryService.getShopItems(interaction.guild.id).find((i: any) => i.itemId === roleId && i.listedPrice === price);
        if (!listing) {
            return interaction.editReply({ content: "❌ Предмет не найден или цена не совпадает" });
        }

        if (listing.userId === interaction.user.id) {
            return interaction.editReply({ content: "❌ Нельзя купить свою же роль" });
        }

        const result = await InventoryService.purchaseItem(
            interaction.user.id,
            listing.userId,
            interaction.guild.id,
            'role',
            roleId,
            price
        );

        if (!result.success) {
            return interaction.editReply({ content: result.error });
        }

        // Выдаём роль в Discord
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const role = await interaction.guild.roles.fetch(roleId);
            if (role && !member.roles.cache.has(roleId)) {
                await member.roles.add(role);
            }
        } catch {}

        await interaction.editReply({ content: `✅ Вы купили роль **${result.itemName}** за **${price}** монет!` });
    }
};