import { Message, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const name = 'pwd';
export const description = 'Print current guild and channel name';
export const aliases = ['curdir'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description);

function getPath(channel: any, guildName?: string): string {
    const channelName = channel.name || 'dm';
    const serverName = guildName || 'Direct Messages';
    return `${serverName}/${channelName}`;
}

export async function execute(message: Message, _args: string[]): Promise<void> {
    const path = getPath(message.channel, message.guild?.name);
    await message.reply(`\`${path}\``);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const path = getPath(interaction.channel, interaction.guild?.name);
    await interaction.reply(`\`${path}\``);
}
