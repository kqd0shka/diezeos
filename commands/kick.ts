import { SlashCommandBuilder, PermissionFlagsBits, ChatInputCommandInteraction } from "discord.js";

export const kick = {

data: new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Кикает выбранного пользователя с сервера.")
    .addUserOption((option) =>
        option
            .setName("user")
            .setDescription("Пользователь")
            .setRequired(true)
    )
    .addStringOption((option) =>
        option
            .setName("reason")
            .setDescription("Причина")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const user = interaction.options.getUser("user");

            if (!user) {
            await interaction.reply("Пользователь не найден или не указан.");
            return;
            }


        const member = await interaction.guild?.members.fetch(user.id);

        if(!member) {
            await interaction.reply("Участник не найден.");
            return;
        }

        await member.kick();

        await interaction.reply(`@${user.tag} был кикнут с сервера`);
    } catch (error) {
        console.error(error);

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp("Ошибка при выполнении команды");
        } else {
            await interaction.reply({
                content: "Ошибка при кике пользователя",
                ephemeral: true,
            });
        }
    }

    }
}