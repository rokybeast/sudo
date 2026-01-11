import { Message, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const name = 'echo';
export const description = 'Echo back a message';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('message')
            .setDescription('The message to echo back')
            .setRequired(true)
    );

export async function execute(message: Message, args: string[]): Promise<void> {
    if (args.length === 0) {
        await message.reply('say something dummy`');
        return;
    }

    const echoMessage = args.join(' ');
    if (message.channel.isSendable()) {
        await message.channel.send(`${echoMessage}`);
    }
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const echoMessage = interaction.options.getString('message', true);
    await interaction.reply(`${echoMessage}`);
}
