import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { InventoryService } from "../services/inventory.service";
import { db } from "../database/database";

export const inventory = {
    data: new SlashCommandBuilder()
        .setName("inventory")
        .setDescription("Показать ваши личные роли и инвентарь")
        .addUserOption(opt => opt.setName("user").setDescription("Посмотреть инвентарь другого")),

    async execute(interaction: ChatInputCommandInteraction) {
        if (!interaction.guild) return;
        
        const target = interaction.options.getUser("user") || interaction.user;
        const inventory = InventoryService.getInventory(target.id, interaction.guild.id);
        const roles = inventory.filter(i => i.itemType === 'role');

        if (roles.length === 0) {
            return interaction.reply({ 
                content: target.id === interaction.user.id 
                    ? "❌ У вас нет личных ролей. Создайте через `/createrole`" 
                    : `❌ У <@${target.id}> нет личных ролей`,
                flags: 64 
            });
        }

        const embed = new EmbedBuilder()
            .setTitle(`🎒 Инвентарь: ${target.tag}`)
            .setColor(0x9b59b6)
            .setThumbnail(target.displayAvatarURL());

        roles.forEach((role: any, i: number) => {
            const status = role.isListed ? `💰 На продаже за ${role.listedPrice}🪙` : '✅ В инвентаре';
            embed.addFields({
                name: `${i + 1}. ${role.itemName}`,
                value: `🎨 #${role.itemColor?.toString(16).padStart(6, '0').toUpperCase()}\n📅 <t:${Math.floor(new Date(role.acquiredAt).getTime() / 1000)}:R>\n${status}`,
                inline: true
            });
        });

        // Кнопки действий (только для владельца)
        let components: ActionRowBuilder<StringSelectMenuBuilder>[] | undefined;;
        if (target.id === interaction.user.id && roles.length > 0) {
            const options = roles.filter((r: any) => !r.isListed).map((r: any) => ({
                label: r.itemName.slice(0, 25),
                value: `sell_${r.itemId}`
            }));
            
            if (options.length > 0) {
                const select = new StringSelectMenuBuilder()
                    .setCustomId('sell_role_select')
                    .setPlaceholder('🔹 Выставить роль на продажу')
                    .addOptions(options.slice(0, 25));
                
                components = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)];
            }
        }

        await interaction.reply({ embeds: [embed], components, flags: target.id !== interaction.user.id ? 64 : undefined });
    }
};