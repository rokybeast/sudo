import { Message, ChatInputCommandInteraction, SlashCommandBuilder, TextChannel, EmbedBuilder } from 'discord.js';

export const name = 'grep';
export const description = 'Search for a pattern in the last N messages';
export const aliases = ['search', 'find'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('pattern')
            .setDescription('The text or regex pattern to search for')
            .setRequired(true)
    )
    .addIntegerOption((option) =>
        option
            .setName('limit')
            .setDescription('Number of messages to check (max 100)')
            .setMinValue(1)
            .setMaxValue(100)
            .setRequired(false)
    )
    .addBooleanOption((option) =>
        option
            .setName('insensitive')
            .setDescription('Case insensitive search (-i)')
            .setRequired(false)
    );

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!message.guild || !message.channel.isTextBased()) {
        await message.reply('This command can only be used in text channels.');
        return;
    }

    // format: grep [-i] <pattern> [limit]
    let insensitive = false;
    let limit = 50;

    const cleanArgs = args.filter(arg => {
        if (arg === '-i') {
            insensitive = true;
            return false;
        }
        return true;
    });

    if (cleanArgs.length === 0) {
        throw new Error('Parameter not found: pattern');
    }

    const pattern = cleanArgs[0];
    if (cleanArgs.length > 1) {
        const parsedLimit = parseInt(cleanArgs[1], 10);
        if (!isNaN(parsedLimit)) limit = Math.min(Math.max(parsedLimit, 1), 100);
    }

    await performGrep(message, message.channel as TextChannel, pattern, limit, insensitive);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.channel || !interaction.channel.isTextBased()) {
        await interaction.reply({ content: 'This command can only be used in text channels.', ephemeral: true });
        return;
    }

    const pattern = interaction.options.getString('pattern', true);
    const limit = interaction.options.getInteger('limit') || 50;
    const insensitive = interaction.options.getBoolean('insensitive') || false;

    await interaction.deferReply();
    await performGrep(interaction, interaction.channel as TextChannel, pattern, limit, insensitive);
}

async function performGrep(
    context: Message | ChatInputCommandInteraction,
    channel: TextChannel,
    pattern: string,
    limit: number,
    insensitive: boolean
) {
    try {
        // get msgs
        const messages = await channel.messages.fetch({ limit: limit });
        const regexFlags = insensitive ? 'i' : '';

        // try to treat as regex
        let regex: RegExp;
        try {
            regex = new RegExp(pattern, regexFlags);
        } catch (e) {
            // fallback to literal string match
            const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escaped, regexFlags);
        }

        const matches = messages.filter(msg => {
            if (context instanceof Message && msg.id === context.id) return false;
            if (msg.author.bot && msg.content.includes('grep result')) return false;

            return regex.test(msg.content);
        });

        if (matches.size === 0) {
            const reply = `No matches found for \`${pattern}\` in the last ${limit} messages.`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        // Build output
        const results = matches.map(msg => {
            let content = msg.content.length > 50
                ? msg.content.substring(0, 50).replace(/\n/g, ' ') + '...'
                : msg.content.replace(/\n/g, ' ');

            // escape mentions to prevent pings
            content = content
                .replace(/<@!?(\d+)>/g, '<@\u200B$1>')  // user mentions
                .replace(/<@&(\d+)>/g, '<@\u200B&$1>')  // role mentions
                .replace(/@(everyone|here)/g, '@\u200B$1');  // @everyone/@here

            return `[${msg.author.username}]: ${content} ([Jump](${msg.url}))`;
        });

        // max char limit 2000; slice if required
        const header = `Found ${matches.size} matches for \`${pattern}\` in last ${limit}:\n`;
        let outputBody = results.join('\n');

        if (outputBody.length > 1900) {
            outputBody = outputBody.substring(0, 1900) + '\n...(truncated)';
        }

        const finalOutput = header + outputBody;

        if (context instanceof Message) await context.reply(finalOutput);
        else await context.editReply(finalOutput);

    } catch (error) {
        console.error('Grep error:', error);
        const errParams = { content: 'An error occurred while searching.', ephemeral: true };
        if (context instanceof Message) await context.reply(errParams.content);
        else await context.editReply(errParams.content);
    }
}
