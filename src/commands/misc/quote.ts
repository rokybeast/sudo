import { Message, ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, GuildMember } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fetch from 'node-fetch';

export const name = 'quote';
export const description = 'Generate a quote image from a message';
export const aliases = ['q'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('message')
            .setDescription('Message ID or message link to quote')
            .setRequired(true)
    );

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 88, g: 101, b: 242 };
}

function getLuminance(r: number, g: number, b: number): number {
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const paragraphs = text.split('\n');
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        let currentLine = '';

        for (const word of words) {
            const wordWidth = ctx.measureText(word).width;
            if (wordWidth > maxWidth) {
                if (currentLine) {
                    lines.push(currentLine);
                    currentLine = '';
                }
                let remaining = word;
                while (remaining.length > 0) {
                    let chars = '';
                    for (let i = 0; i < remaining.length; i++) {
                        const testChars = remaining.slice(0, i + 1);
                        if (ctx.measureText(testChars).width > maxWidth) {
                            break;
                        }
                        chars = testChars;
                    }
                    if (chars.length === 0) chars = remaining[0];
                    lines.push(chars);
                    remaining = remaining.slice(chars.length);
                }
                continue;
            }

            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }
    }

    return lines;
}

function parseMarkdown(text: string): { text: string; bold: boolean; italic: boolean; code: boolean }[] {
    const segments: { text: string; bold: boolean; italic: boolean; code: boolean }[] = [];

    let remaining = text;

    while (remaining.length > 0) {
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
            segments.push({ text: boldMatch[1], bold: true, italic: false, code: false });
            remaining = remaining.slice(boldMatch[0].length);
            continue;
        }

        const italicMatch = remaining.match(/^\*(.+?)\*/);
        if (italicMatch) {
            segments.push({ text: italicMatch[1], bold: false, italic: true, code: false });
            remaining = remaining.slice(italicMatch[0].length);
            continue;
        }

        const codeMatch = remaining.match(/^`(.+?)`/);
        if (codeMatch) {
            segments.push({ text: codeMatch[1], bold: false, italic: false, code: true });
            remaining = remaining.slice(codeMatch[0].length);
            continue;
        }

        const nextSpecial = remaining.search(/[\*`]/);
        if (nextSpecial === -1) {
            segments.push({ text: remaining, bold: false, italic: false, code: false });
            break;
        } else if (nextSpecial === 0) {
            segments.push({ text: remaining[0], bold: false, italic: false, code: false });
            remaining = remaining.slice(1);
        } else {
            segments.push({ text: remaining.slice(0, nextSpecial), bold: false, italic: false, code: false });
            remaining = remaining.slice(nextSpecial);
        }
    }

    return segments;
}

async function generateQuoteImage(
    content: string,
    username: string,
    avatarUrl: string,
    userColor: string,
    timestamp: Date
): Promise<Buffer> {
    const padding = 40;
    const avatarSize = 64;
    const maxWidth = 500;
    const fontSize = 20;
    const lineHeight = fontSize * 1.4;
    const attrFontSize = 16;
    const attrLineHeight = attrFontSize * 1.4;

    const tempCanvas = createCanvas(maxWidth, 100);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.font = `${fontSize}px sans-serif`;

    const quotedContent = `"${content}"`;
    const wrappedLines = wrapText(tempCtx, quotedContent, maxWidth - padding * 2);
    const textHeight = wrappedLines.length * lineHeight;

    const attrText = `- ${username}`;

    tempCtx.font = `${attrFontSize}px sans-serif`;
    const attrLines = wrapText(tempCtx, attrText, maxWidth - padding * 2);
    const attrHeight = attrLines.length * attrLineHeight;

    const canvasWidth = maxWidth;
    const canvasHeight = padding + avatarSize + 20 + textHeight + 20 + attrHeight + padding;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    const rgb = hexToRgb(userColor);
    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);

    const gradient = ctx.createLinearGradient(0, 0, canvasWidth, 0);
    gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`);
    gradient.addColorStop(0.3, `rgba(${Math.max(0, rgb.r - 20)}, ${Math.max(0, rgb.g - 20)}, ${Math.max(0, rgb.b - 20)}, 0.95)`);
    gradient.addColorStop(0.7, `rgba(${Math.max(0, rgb.r - 50)}, ${Math.max(0, rgb.g - 50)}, ${Math.max(0, rgb.b - 50)}, 0.9)`);
    gradient.addColorStop(1, `rgba(${Math.max(0, rgb.r - 80)}, ${Math.max(0, rgb.g - 80)}, ${Math.max(0, rgb.b - 80)}, 0.85)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const textColor = luminance > 0.5 ? '#000000' : '#ffffff';
    const subtextColor = luminance > 0.5 ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';

    try {
        const avatarResponse = await fetch(avatarUrl);
        const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
        const avatar = await loadImage(avatarBuffer);

        ctx.save();
        ctx.beginPath();
        ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, padding, padding, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = textColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.stroke();
    } catch (e) {
        ctx.fillStyle = subtextColor;
        ctx.beginPath();
        ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px sans-serif`;

    let y = padding + avatarSize + 30;
    for (const line of wrappedLines) {
        ctx.fillText(line, padding, y);
        y += lineHeight;
    }

    ctx.fillStyle = subtextColor;
    ctx.font = `${attrFontSize}px sans-serif`;
    y += 10;
    for (const line of attrLines) {
        ctx.fillText(line, padding, y);
        y += attrLineHeight;
    }

    return canvas.toBuffer('image/png');
}

export async function execute(message: Message, args: string[]): Promise<void> {
    let channel: any = message.channel;
    let messageId: string | undefined;

    if (message.reference?.messageId) {
        messageId = message.reference.messageId;
    } else if (args.length > 0) {
        const input = args[0];

        const linkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
        const linkMatch = input.match(linkRegex);

        if (linkMatch) {
            const [, guildId, channelId, msgId] = linkMatch;

            if (guildId !== message.guildId) {
                throw new Error('Message must be from this server');
            }

            try {
                channel = await message.client.channels.fetch(channelId);
                if (!channel || !channel.isTextBased()) {
                    throw new Error('Could not find the channel');
                }
            } catch {
                throw new Error('Could not find the channel');
            }

            messageId = msgId;
        } else {
            messageId = input;
        }
    }

    if (!messageId) {
        throw new Error('Reply to a message, provide a message ID, or a message link');
    }

    let quotedMessage;
    try {
        quotedMessage = await channel.messages.fetch(messageId);
    } catch {
        throw new Error('Could not find that message');
    }

    if (!quotedMessage.content) {
        throw new Error('The quoted message has no text content');
    }

    const member = quotedMessage.member as GuildMember | null;
    const userColor = member?.displayHexColor || '#5865F2';
    const avatarUrl = quotedMessage.author.displayAvatarURL({ extension: 'png', size: 128 });

    const imageBuffer = await generateQuoteImage(
        quotedMessage.content,
        quotedMessage.author.username,
        avatarUrl,
        userColor,
        quotedMessage.createdAt
    );

    const attachment = new AttachmentBuilder(imageBuffer, { name: 'quote.png' });
    await message.reply({ files: [attachment] });
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('message', true);

    await interaction.deferReply();

    const linkRegex = /https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/;
    const linkMatch = input.match(linkRegex);

    let channel: any;
    let messageId: string;

    if (linkMatch) {
        const [, guildId, channelId, msgId] = linkMatch;

        if (guildId !== interaction.guildId) {
            await interaction.editReply('Message must be from this server');
            return;
        }

        try {
            channel = await interaction.client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                await interaction.editReply('Could not find the channel');
                return;
            }
        } catch {
            await interaction.editReply('Could not find the channel');
            return;
        }

        messageId = msgId;
    } else {
        if (!interaction.channel || !interaction.channel.isTextBased()) {
            await interaction.editReply('This command can only be used in text channels');
            return;
        }
        channel = interaction.channel;
        messageId = input;
    }

    try {
        const quotedMessage = await channel.messages.fetch(messageId);

        if (!quotedMessage.content) {
            await interaction.editReply('The quoted message has no text content');
            return;
        }

        const member = quotedMessage.member as GuildMember | null;
        const userColor = member?.displayHexColor || '#5865F2';
        const avatarUrl = quotedMessage.author.displayAvatarURL({ extension: 'png', size: 128 });

        const imageBuffer = await generateQuoteImage(
            quotedMessage.content,
            quotedMessage.author.username,
            avatarUrl,
            userColor,
            quotedMessage.createdAt
        );

        const attachment = new AttachmentBuilder(imageBuffer, { name: 'quote.png' });
        await interaction.editReply({ files: [attachment] });

    } catch (error) {
        console.error('Quote error:', error);
        await interaction.editReply('Could not find that message');
    }
}
