import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ChannelType, version as djsVersion } from 'discord.js';
import os from 'os';

export const name = 'top';
export const description = 'Display server statistics and bot resources';
export const aliases = ['htop', 'stats', 'serverinfo'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('view')
            .setDescription('The stats view to show')
            .setRequired(false)
            .addChoices(
                { name: 'General', value: 'general' },
                { name: 'Users', value: 'users' },
                { name: 'Channels', value: 'channels' },
                { name: 'System', value: 'system' }
            )
    );

export async function execute(message: Message, args: string[]): Promise<void> {
    const view = args[0] ? args[0].toLowerCase() : 'general';
    await sendTop(message, view);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const view = interaction.options.getString('view') || 'general';
    await interaction.reply({ content: 'Fetching stats...', fetchReply: true }); // Defer effectively
    await sendTop(interaction, view);
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

async function sendTop(context: Message | ChatInputCommandInteraction, view: string) {
    const guild = context.guild;
    const client = context.client;

    if (!guild) {
        const reply = '❌ This command can only be used in a server.';
        if (context instanceof Message) await context.reply(reply);
        else await context.editReply(reply);
        return;
    }

    const embed = new EmbedBuilder().setColor(0x0099ff).setTimestamp();

    // Views
    if (view === 'system' || view.startsWith('sys')) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const seconds = Math.floor(uptime % 60);

        const memUsage = process.memoryUsage();
        const osLoad = os.loadavg();

        embed.setTitle('System Processes');
        embed.setDescription('Real-time resource usage');
        embed.addFields(
            { name: 'PID', value: `${process.pid}`, inline: true },
            { name: 'Uptime', value: `${days}d ${hours}h ${minutes}m ${seconds}s`, inline: true },
            { name: 'Platform', value: `${os.platform()} ${os.release()}`, inline: true },
            { name: 'Memory (RSS)', value: formatBytes(memUsage.rss), inline: true },
            { name: 'Memory (Heap)', value: `${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}`, inline: true },
            { name: 'Load Avg', value: `${osLoad[0].toFixed(2)}, ${osLoad[1].toFixed(2)}, ${osLoad[2].toFixed(2)}`, inline: true },
            { name: 'Node.js', value: process.version, inline: true },
            { name: 'Discord.js', value: `v${djsVersion}`, inline: true },
            { name: 'WS Ping', value: `${client.ws.ping}ms`, inline: true }
        );

    } else if (view === 'users' || view.startsWith('user')) {
        const totalUsers = guild.memberCount;
        await guild.members.fetch(); // Ensure cache is populated
        const humans = guild.members.cache.filter(m => !m.user.bot).size;
        const bots = guild.members.cache.filter(m => m.user.bot).size;

        const online = guild.members.cache.filter(m => m.presence?.status === 'online').size;
        const idle = guild.members.cache.filter(m => m.presence?.status === 'idle').size;
        const dnd = guild.members.cache.filter(m => m.presence?.status === 'dnd').size;

        embed.setTitle('User Processes');
        embed.addFields(
            { name: 'Total Accounts', value: `${totalUsers}`, inline: true },
            { name: 'Humans', value: `${humans}`, inline: true },
            { name: 'Bots', value: `${bots}`, inline: true },
            { name: 'Online', value: `${online}`, inline: true },
            { name: 'Idle', value: `${idle}`, inline: true },
            { name: 'DND', value: `${dnd}`, inline: true }
        );

    } else if (view === 'channels' || view.startsWith('chan')) {
        const total = guild.channels.cache.size;
        const text = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
        const voice = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
        const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;
        const threads = guild.channels.cache.filter(c => c.isThread()).size;

        embed.setTitle('Filesystem');
        embed.addFields(
            { name: 'Total Inodes', value: `${total}`, inline: true },
            { name: 'Text', value: `${text}`, inline: true },
            { name: 'Voice', value: `${voice}`, inline: true },
            { name: 'Categories', value: `${categories}`, inline: true },
            { name: 'Threads', value: `${threads}`, inline: true }
        );

    } else {
        embed.setTitle(`System Info: ${guild.name}`);
        if (guild.iconURL()) embed.setThumbnail(guild.iconURL());

        const owner = await guild.fetchOwner();
        const createdTimestamp = Math.floor(guild.createdTimestamp / 1000);

        embed.addFields(
            { name: 'Owner', value: owner.user.tag, inline: true },
            { name: 'ID', value: guild.id, inline: true },
            { name: 'Created', value: `<t:${createdTimestamp}:R>`, inline: true },
            { name: 'Boost Tier', value: `${guild.premiumTier}`, inline: true },
            { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0}`, inline: true },
            { name: 'Verification', value: `${guild.verificationLevel}`, inline: true },
            { name: 'Users', value: `${guild.memberCount}`, inline: true },
            { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
            { name: 'Emojis', value: `${guild.emojis.cache.size}`, inline: true }
        );
        embed.setFooter({ text: 'Use "top users", "top channels", or "top system" for more details.' });
    }

    if (context instanceof Message) await context.reply({ embeds: [embed] });
    else await context.editReply({ embeds: [embed] });
}
