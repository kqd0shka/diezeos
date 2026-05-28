import { ModalSubmitInteraction } from "discord.js";
import { InventoryService } from "../services/inventory.service";

export async function handleSellRoleModal(interaction: ModalSubmitInteraction) {
    const roleId = interaction.customId.replace('sell_role_modal_', '');
    const price = parseInt(interaction.fields.getTextInputValue('price'));

    if (isNaN(price) || price < 500) {
        return interaction.reply({ 
            content: "❌ Минимальная цена: 500 монет", 
            flags: 64 
        });
    }

    const result = await InventoryService.listForSale(
        interaction.user.id,
        interaction.guild!.id,
        'role',
        roleId,
        price
    );

    if (!result.success) {
        return interaction.reply({ content: result.error, flags: 64 });
    }

    await interaction.reply({ 
        content: `✅ Роль выставлена на продажу за **${price}** монет!`, 
        flags: 64 
    });
}