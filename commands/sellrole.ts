import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { InventoryService } from "../services/inventory.service";

export const sellrole = {
    data: new SlashCommandBuilder()
        .setName("sellrole")
        .setDescription("Выставить личную роль на продажу")
        .addStringOption(opt => 
            opt.setName("role_id").setDescription("ID роли (из /inventory)").setRequired(true)
        )
        .addIntegerOption(opt => 
            opt.setName("price").setDescription("Цена в монетах (мин. 300)").setRequired(true).setMinValue(300)
        ),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const roleId = interaction.options.getString("role_id", true);
        const price = interaction.options.getInteger("price", true);

        await interaction.deferReply({ flags: 64 });

        const result = await InventoryService.listForSale(
            interaction.user.id,
            interaction.guild.id,
            'role',
            roleId,
            price
        );

        if (!result.success) {
            return interaction.editReply({ content: result.error });
        }

        await interaction.editReply({ content: `✅ Роль выставлена на продажу за **${price}** монет!` });
    }
};