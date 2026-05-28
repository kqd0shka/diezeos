import { StringSelectMenuInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from "discord.js";

export async function handleSellRoleSelect(interaction: StringSelectMenuInteraction) {
    const selectedValue = interaction.values[0]; // Например: "sell_ROLE_ID"
    const [, roleId] = selectedValue.split('_');

    if (!roleId) {
        return interaction.reply({ content: "❌ Ошибка: неверный ID роли", flags: 64 });
    }

    // Создаём модалку для ввода цены
    const modal = new ModalBuilder()
        .setCustomId(`sell_role_modal_${roleId}`)
        .setTitle('💰 Выставить роль на продажу');

    const priceInput = new TextInputBuilder()
        .setCustomId('price')
        .setLabel('Цена в монетах')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Минимум: 500')
        .setMinLength(1)
        .setMaxLength(10)
        .setRequired(true);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(priceInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
}