import { Message, ChatInputCommandInteraction, SlashCommandBuilder, ChannelType, GuildBasedChannel, Collection } from 'discord.js';

export const name = 'ls';
export const description = 'List channels in the current guild';
export const aliases = ['listdir'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description);

function getIcon(channel: GuildBasedChannel): string {
    if (channel.type === ChannelType.GuildCategory) return '📁';
    if (channel.type === ChannelType.GuildVoice) return '🔊';
    if (channel.type === ChannelType.GuildText) return '📝';
    if (channel.type === ChannelType.GuildAnnouncement) return '📢';
    if (channel.type === ChannelType.GuildStageVoice) return '🎭';
    if (channel.type === ChannelType.GuildForum) return '💬';
    return '📄';
}

function generateTree(channels: Collection<string, GuildBasedChannel>, guildName: string): string {
    let output = `${guildName}\n`;

    const rootChannels = channels
        .filter(c => !c.parent && ![ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(c.type))
        .sorted((a, b) => ((a as any).position || 0) - ((b as any).position || 0));

    rootChannels.forEach((channel, index) => {
        const isLast = index === rootChannels.size - 1;
        const prefix = isLast ? '└── ' : '├── ';
        const icon = getIcon(channel);

        output += `${prefix}${icon} ${channel.name}\n`;

        if (channel.type === ChannelType.GuildCategory) {
            const children = channels
                .filter(c => c.parentId === channel.id && ![ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.AnnouncementThread].includes(c.type))
                .sorted((a, b) => ((a as any).position || 0) - ((b as any).position || 0));

            children.forEach((child, childIndex) => {
                const isChildLast = childIndex === children.size - 1;
                const childPrefix = isLast ? '    ' : '│   ';
                const connector = isChildLast ? '└── ' : '├── ';
                const childIcon = getIcon(child);

                output += `${childPrefix}${connector}${childIcon} ${child.name}\n`;
            });
        }
    });

    return output;
}

export async function execute(message: Message, _args: string[]): Promise<void> {
    if (!message.guild) {
        await message.reply('This command can only be used in a server.');
        return;
    }

    const tree = generateTree(message.guild.channels.cache, message.guild.name);

    // Split if too long (simple split, might break tree visual slightly but safer than error)
    if (tree.length > 1900) {
        const chunks = tree.match(/[\s\S]{1,1900}/g) || [];
        for (const chunk of chunks) {
            if (message.channel.isSendable()) {
                await message.channel.send(`\`\`\`\n${chunk}\n\`\`\``);
            }
        }
    } else {
        await message.reply(`\`\`\`\n${tree}\n\`\`\``);
    }
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const tree = generateTree(interaction.guild.channels.cache, interaction.guild.name);

    if (tree.length > 1900) {
        const chunks = tree.match(/[\s\S]{1,1900}/g) || [];
        await interaction.reply(`\`\`\`\n${chunks[0]}\n\`\`\``);
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(`\`\`\`\n${chunks[i]}\n\`\`\``);
        }
    } else {
        await interaction.reply(`\`\`\`\n${tree}\n\`\`\``);
    }
}
