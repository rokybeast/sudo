import { Message, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const name = 'whatis';
export const description = 'Display a one-line description of a command';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('command')
            .setDescription('The command to check')
            .setRequired(true)
    );

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!args.length) {
        await message.reply('usage: whatis <command>');
        return;
    }

    const { commands } = message.client;
    const name = args[0].toLowerCase();
    const command = commands.get(name) || commands.find((c) => c.aliases && c.aliases.includes(name));

    if (!command) {
        await message.reply(`${name}: nothing appropriate.`);
        return;
    }

    await message.reply(`${command.name} (1) - ${command.description}`);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commands } = interaction.client;
    const name = interaction.options.getString('command', true).toLowerCase();
    const command = commands.get(name) || commands.find((c) => c.aliases && c.aliases.includes(name));

    if (!command) {
        await interaction.reply({ content: `${name}: nothing appropriate.`, ephemeral: true });
        return;
    }

    await interaction.reply(`${command.name} (1) - ${command.description}`);
}
