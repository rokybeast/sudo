import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, ColorResolvable, GuildMember } from 'discord.js';


export const name = 'cat';
export const description = 'Display detailed user information';
export const aliases = ['userinfo', 'whois'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption((option) =>
        option
            .setName('user')
            .setDescription('The user to look up')
            .setRequired(false)
    );

export async function execute(message: Message, args: string[]): Promise<void> {
    const targetUser = message.mentions.users.first() || message.author;
    const member = message.guild?.members.cache.get(targetUser.id);

    await sendUserInfo(message, targetUser, member);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const member = interaction.guild?.members.cache.get(targetUser.id);

    await interaction.deferReply();
    await sendUserInfo(interaction, targetUser, member);
}

async function sendUserInfo(
    context: Message | ChatInputCommandInteraction,
    user: any,
    member: GuildMember | undefined
) {
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 1024 });
    const color = member?.displayHexColor || 0x0099ff;

    const embed = new EmbedBuilder()
        .setAuthor({ name: user.tag, iconURL: avatarUrl })
        .setThumbnail(avatarUrl)
        .setColor(color)
        .addFields(
            { name: '🆔 ID', value: user.id, inline: true },
            { name: '🤖 Bot', value: user.bot ? 'Yes' : 'No', inline: true },
            { name: '📅 Created At', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:F> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)`, inline: false }
        );

    if (member) {
        if (member.joinedTimestamp) {
            embed.addFields({
                name: '📥 Joined Server',
                value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:F> (<t:${Math.floor(member.joinedTimestamp / 1000)}:R>)`,
                inline: false
            });
        }

        if (member.nickname) {
            embed.addFields({ name: '🏷️ Nickname', value: member.nickname, inline: true });
        }

        // Roles (exclude @everyone)
        const roles = member.roles.cache
            .filter(r => r.id !== member.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.toString())
            .join(', ');

        if (roles) {
            embed.addFields({ name: `🎭 Roles [${member.roles.cache.size - 1}]`, value: roles.length > 1024 ? roles.slice(0, 1021) + '...' : roles, inline: false });
        }
    }

    embed.setFooter({ text: `Requested by ${context instanceof Message ? context.author.tag : context.user.tag}` });

    if (context instanceof Message) {
        await context.reply({ embeds: [embed] });
    } else {
        await context.editReply({ embeds: [embed] });
    }
}
