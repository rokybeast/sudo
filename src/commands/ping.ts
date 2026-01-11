import { Message, ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

export const name = 'ping';
export const description = 'Check bot latency and API ping';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description);

export async function execute(message: Message, _args: string[]): Promise<void> {
    const sent = await message.reply('Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(message.client.ws.ping);

    await sent.edit(`**Pong!**\nLatency: \`${latency}ms\`\nAPI Latency: \`${apiLatency}ms\``);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const sent = await interaction.reply({ content: 'Pinging...', fetchReply: true });
    const latency = sent.createdTimestamp - interaction.createdTimestamp;
    const apiLatency = Math.round(interaction.client.ws.ping);

    await interaction.editReply(`**Pong!**\nLatency: \`${latency}ms\`\nAPI Latency: \`${apiLatency}ms\``);
}
