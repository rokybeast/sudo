import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ChannelType, GuildBasedChannel, TextChannel, VoiceChannel, ThreadChannel, StageChannel } from 'discord.js';

export const name = 'file';
export const description = 'Display detailed channel information';
export const aliases = ['stat', 'channelinfo'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addChannelOption((option) =>
        option
            .setName('channel')
            .setDescription('The channel to inspect')
            .setRequired(false)
    );

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!message.guild) {
        throw new Error('This command can only be used in a server.');
    }

    let targetChannel: GuildBasedChannel | undefined;

    const mentionedChannel = message.mentions.channels.first();
    if (mentionedChannel) {
        targetChannel = message.guild.channels.cache.get(mentionedChannel.id);
    } else if (args.length > 0) {
        targetChannel = message.guild.channels.cache.get(args[0]);
        if (!targetChannel) {
            const nameMatch = args.join(' ').toLowerCase();
            targetChannel = message.guild.channels.cache.find(c => c.name.toLowerCase() === nameMatch);
        }
    } else {
        targetChannel = message.channel as GuildBasedChannel;
    }

    if (!targetChannel) {
        throw new Error('Channel not found.');
    }

    await sendChannelInfo(message, targetChannel);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const channelInput = interaction.options.getChannel('channel');
    const targetChannel = channelInput
        ? interaction.guild.channels.cache.get(channelInput.id)
        : interaction.channel as GuildBasedChannel;

    if (!targetChannel) {
        await interaction.reply({ content: 'Channel not found.', ephemeral: true });
        return;
    }

    await interaction.deferReply();
    await sendChannelInfo(interaction, targetChannel);
}

function getChannelTypeString(type: ChannelType): string {
    switch (type) {
        case ChannelType.GuildText: return 'Text Channel';
        case ChannelType.GuildVoice: return 'Voice Channel';
        case ChannelType.GuildCategory: return 'Category';
        case ChannelType.GuildAnnouncement: return 'Announcement Channel';
        case ChannelType.AnnouncementThread: return 'Announcement Thread';
        case ChannelType.PublicThread: return 'Public Thread';
        case ChannelType.PrivateThread: return 'Private Thread';
        case ChannelType.GuildStageVoice: return 'Stage Channel';
        case ChannelType.GuildForum: return 'Forum Channel';
        default: return `Unknown (${type})`;
    }
}

async function sendChannelInfo(
    context: Message | ChatInputCommandInteraction,
    channel: GuildBasedChannel
) {
    const embed = new EmbedBuilder()
        .setTitle(`${channel.name}`)
        .setColor(0x000000)
        .addFields(
            { name: 'ID', value: channel.id, inline: true },
            { name: 'Type', value: getChannelTypeString(channel.type), inline: true },
            { name: 'Created', value: `<t:${Math.floor(channel.createdTimestamp / 1000)}:R>`, inline: true }
        );

    if (channel.parentId) {
        const parent = channel.guild.channels.cache.get(channel.parentId);
        if (parent) {
            embed.addFields({ name: 'Category', value: parent.name, inline: true });
        }
    }

    if (channel.isTextBased()) {
        if ('topic' in channel && channel.topic) {
            embed.setDescription(channel.topic);
        }

        if ('nsfw' in channel && channel.nsfw) {
            embed.addFields({ name: 'NSFW', value: 'Yes', inline: true });
        }

        if ('rateLimitPerUser' in channel && channel.rateLimitPerUser > 0) {
            embed.addFields({ name: 'Slowmode', value: `${channel.rateLimitPerUser}s`, inline: true });
        }
    }

    if (channel.isVoiceBased()) {
        const voiceChan = channel as VoiceChannel | StageChannel;
        embed.addFields({
            name: 'Bitrate',
            value: `${voiceChan.bitrate / 1000}kbps`,
            inline: true
        });

        if (voiceChan.userLimit > 0) {
            embed.addFields({
                name: 'User Limit',
                value: `${voiceChan.members.size}/${voiceChan.userLimit}`,
                inline: true
            });
        } else {
            embed.addFields({
                name: 'Users',
                value: `${voiceChan.members.size}`,
                inline: true
            });
        }

        if (voiceChan.rtcRegion) {
            embed.addFields({ name: 'Region', value: voiceChan.rtcRegion, inline: true });
        }
    }

    if (channel.isThread()) {
        const thread = channel as ThreadChannel;
        embed.addFields({
            name: 'Archives After',
            value: thread.autoArchiveDuration ? `${thread.autoArchiveDuration / 60}h` : 'Unknown',
            inline: true
        });

        embed.addFields({
            name: 'Message Count',
            value: `${thread.messageCount || 0}`,
            inline: true
        });

        if (thread.ownerId) {
            embed.addFields({ name: 'Owner', value: `<@${thread.ownerId}>`, inline: true });
        }
    }

    if (!channel.isThread() && 'position' in channel) {
        embed.addFields({ name: 'Position', value: `${(channel as any).position}`, inline: true });
    }

    embed.setFooter({ text: `Guild: ${channel.guild.name}` });

    if (context instanceof Message) await context.reply({ embeds: [embed] });
    else await context.editReply({ embeds: [embed] });
}
