import { Message, ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, GuildMember, TextChannel } from 'discord.js';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import fetch from 'node-fetch';
import GIFEncoder from 'gifencoder';
import gifFrames from 'gif-frames';
import { Stream } from 'stream';

export const name = 'quote';
export const description = 'Generate a quote image from a message';
export const aliases = ['q'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('message')
            .setDescription('Message ID, link, or text to quote')
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

function getDominantColor(image: Image): { r: number, g: number, b: number } {
    const canvas = createCanvas(1, 1);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    const r = data[0];
    const g = data[1];
    const b = data[2];
    return { r, g, b };
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

interface QuoteOptions {
    content: string;
    username: string;
    avatarUrl: string;
    userColor: string;
    timestamp: Date;
    attachmentUrl?: string;
    isGif?: boolean;
}

async function drawQuoteCard(
    ctx: any,
    width: number,
    height: number,
    options: QuoteOptions,
    avatarImage: Image,
    dominantColor: { r: number, g: number, b: number },
    wrappedLines: string[],
    attrLines: string[],
    attachmentImage?: Image,
    attachmentHeight: number = 0
) {
    const { r, g, b } = dominantColor;
    const luminance = getLuminance(r, g, b);

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `rgba(${Math.min(255, r + 40)}, ${Math.min(255, g + 40)}, ${Math.min(255, b + 40)}, 1)`);
    gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
    gradient.addColorStop(1, `rgba(${Math.max(0, r - 60)}, ${Math.max(0, g - 60)}, ${Math.max(0, b - 60)}, 1)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    const textColor = luminance > 0.5 ? '#000000' : '#ffffff';
    const subtextColor = luminance > 0.5 ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)';

    const padding = 40;
    const avatarSize = 64;
    const fontSize = 20;
    const lineHeight = fontSize * 1.4;
    const attrFontSize = 16;
    const attrLineHeight = attrFontSize * 1.4;

    ctx.save();
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatarImage, padding, padding, avatarSize, avatarSize);
    ctx.restore();

    ctx.strokeStyle = textColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px sans-serif`;

    let y = padding + avatarSize + 30;
    for (const line of wrappedLines) {
        ctx.fillText(line, padding, y);
        y += lineHeight;
    }

    if (attachmentImage) {
        y += 10;
        const displayWidth = width - (padding * 2);
        const scale = displayWidth / attachmentImage.width;
        const displayHeight = attachmentImage.height * scale;

        ctx.drawImage(attachmentImage, padding, y, displayWidth, displayHeight);
        y += displayHeight;
    }

    ctx.fillStyle = subtextColor;
    ctx.font = `${attrFontSize}px sans-serif`;
    y += 20;
    for (const line of attrLines) {
        ctx.fillText(line, padding, y);
        y += attrLineHeight;
    }
}

async function generateQuote(options: QuoteOptions): Promise<Buffer> {
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

    const quotedContent = options.content ? `"${options.content}"` : '';
    const wrappedLines = options.content ? wrapText(tempCtx, quotedContent, maxWidth - padding * 2) : [];
    const textHeight = wrappedLines.length * lineHeight;

    tempCtx.font = `${attrFontSize}px sans-serif`;
    const attrText = `- ${options.username}`;
    const attrLines = wrapText(tempCtx, attrText, maxWidth - padding * 2);
    const attrHeight = attrLines.length * attrLineHeight;

    const avatarResponse = await fetch(options.avatarUrl);
    const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
    const avatarImage = await loadImage(avatarBuffer);
    const dominantColor = getDominantColor(avatarImage);

    let attachmentImage: Image | undefined;
    let attachmentHeight = 0;
    let frames: any[] = [];

    if (options.attachmentUrl) {
        if (options.isGif) {
            try {
                const frameData = await gifFrames({ url: options.attachmentUrl, frames: 'all', outputType: 'canvas', cumulative: true });
                frames = frameData;
                if (frames.length > 0) {
                    const firstFrame = frames[0];

                    const width = firstFrame.frameInfo.width;
                    const height = firstFrame.frameInfo.height;

                    const displayWidth = maxWidth - (padding * 2);
                    const scale = displayWidth / width;
                    attachmentHeight = height * scale;
                }
            } catch (e) {
                console.error("Failed to load GIF frames", e);
                options.isGif = false;
            }
        }

        if (!options.isGif) {
            try {
                const imgResponse = await fetch(options.attachmentUrl);
                const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
                attachmentImage = await loadImage(imgBuffer);
                const displayWidth = maxWidth - (padding * 2);
                const scale = displayWidth / attachmentImage.width;
                attachmentHeight = attachmentImage.height * scale;
            } catch (e) {
                console.error("Failed to load attachment image", e);
            }
        }
    }

    const canvasHeight = padding + avatarSize + (textHeight > 0 ? 20 : 0) + textHeight + (attachmentHeight > 0 ? 20 : 0) + attachmentHeight + 20 + attrHeight + padding;

    if (options.isGif && frames.length > 0) {
        const encoder = new GIFEncoder(maxWidth, Math.ceil(canvasHeight));
        const stream = encoder.createReadStream();
        encoder.start();
        encoder.setRepeat(0);
        encoder.setDelay(100);
        encoder.setQuality(10);

        const chunks: any[] = [];
        const bufferPromise = new Promise<Buffer>((resolve, reject) => {
            stream.on('data', (chunk) => chunks.push(chunk));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });

        const canvas = createCanvas(maxWidth, Math.ceil(canvasHeight));
        const ctx = canvas.getContext('2d');

        for (const frame of frames) {
            ctx.clearRect(0, 0, maxWidth, canvasHeight);

            const frameCanvas = frame.getImage();
        }

        const frameData = await gifFrames({ url: options.attachmentUrl!, frames: 'all', outputType: 'png', cumulative: true });

        for (const frame of frameData) {
            const frameStream = frame.getImage();
            const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
                const parts: any[] = [];
                frameStream.on('data', (p: any) => parts.push(p));
                frameStream.on('end', () => resolve(Buffer.concat(parts)));
                frameStream.on('error', reject);
            });

            const frameImg = await loadImage(frameBuffer);

            if (frame.frameInfo && frame.frameInfo.delay) {
                encoder.setDelay(frame.frameInfo.delay * 10);
            }

            drawQuoteCard(ctx, maxWidth, Math.ceil(canvasHeight), options, avatarImage, dominantColor, wrappedLines, attrLines, frameImg, attachmentHeight);
            encoder.addFrame(ctx as any);
        }

        encoder.finish();
        return bufferPromise;

    } else {
        const canvas = createCanvas(maxWidth, Math.ceil(canvasHeight));
        const ctx = canvas.getContext('2d');
        await drawQuoteCard(ctx, maxWidth, Math.ceil(canvasHeight), options, avatarImage, dominantColor, wrappedLines, attrLines, attachmentImage, attachmentHeight);
        return canvas.toBuffer('image/png');
    }
}

export async function execute(message: Message, args: string[]): Promise<void> {
    let targetMessage: Message | null = null;
    let contentOverride: string | undefined;

    if (message.reference?.messageId) {
        try {
            const channel = message.channel as TextChannel;
            targetMessage = await channel.messages.fetch(message.reference.messageId);
        } catch { }
    }

    if (!targetMessage && args.length > 0) {
        const input = args[0];
        const linkMatch = input.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);

        if (linkMatch) {
            const [, guildId, channelId, msgId] = linkMatch;
            if (guildId === message.guildId) {
                try {
                    const channel = await message.client.channels.fetch(channelId) as TextChannel;
                    targetMessage = await channel.messages.fetch(msgId);
                } catch { }
            }
        } else if (/^\d+$/.test(input)) {
            try {
                targetMessage = await (message.channel as TextChannel).messages.fetch(input);
            } catch {
                // not a message id
            }
        }
    }

    if (!targetMessage) {
        if (args.length === 0) {
            throw new Error('Please provide text, a link, or reply to a message.');
        }

        const text = args.join(' ');

        const urlRegex = /^(https?:\/\/[^\s]+)$/;
        const urlMatch = text.match(urlRegex);
        const isUrl = !!urlMatch;
        const isGif = isUrl && (text.endsWith('.gif') || text.includes('giphy') || text.includes('tenor')); // Simple check

        const options: QuoteOptions = {
            content: isUrl ? '' : text,
            username: message.author.username,
            avatarUrl: message.author.displayAvatarURL({ extension: 'png', size: 128 }),
            userColor: message.member?.displayHexColor || '#5865F2',
            timestamp: new Date(),
            attachmentUrl: isUrl ? text : undefined,
            isGif: isGif
        };

        const buffer = await generateQuote(options);
        const attachment = new AttachmentBuilder(buffer, { name: isGif ? 'quote.gif' : 'quote.png' });
        await message.reply({ files: [attachment] });
        return;
    }

    const attachment = targetMessage.attachments.first();
    const isGif = attachment?.contentType?.includes('gif') || targetMessage.content.match(/https?:\/\/[^\s]+\.gif/i) !== null;
    let attachmentUrl = attachment?.url;

    if (!attachmentUrl) {
        const match = targetMessage.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif)|https?:\/\/media\.giphy\.com[^\s]+)/i);
        if (match) {
            attachmentUrl = match[0];
            if (attachmentUrl.includes('.gif') || attachmentUrl.includes('giphy')) {
                // it is gif
            }
        }
    }

    let cleanContent = targetMessage.content.replace(/(https?:\/\/[^\s]+)/g, '').trim();

    if (attachmentUrl) {
        cleanContent = targetMessage.content.replace(attachmentUrl, '').trim();
    } else {
        cleanContent = targetMessage.content;
    }

    const options: QuoteOptions = {
        content: cleanContent,
        username: targetMessage.author.username,
        avatarUrl: targetMessage.author.displayAvatarURL({ extension: 'png', size: 128 }),
        userColor: targetMessage.member?.displayHexColor || '#5865F2',
        timestamp: targetMessage.createdAt,
        attachmentUrl: attachmentUrl,
        isGif: isGif
    };

    const buffer = await generateQuote(options);
    const resultAttachment = new AttachmentBuilder(buffer, { name: options.isGif ? 'quote.gif' : 'quote.png' });
    await message.reply({ files: [resultAttachment] });
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const input = interaction.options.getString('message', true);
    await interaction.deferReply();

    let targetMessage: Message | null = null;

    const linkMatch = input.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (linkMatch) {
        const [, guildId, channelId, msgId] = linkMatch;
        if (guildId === interaction.guildId) {
            try {
                const channel = await interaction.client.channels.fetch(channelId) as TextChannel;
                targetMessage = await channel.messages.fetch(msgId);
            } catch { }
        }
    } else if (/^\d+$/.test(input)) {
        try {
            targetMessage = await (interaction.channel as TextChannel).messages.fetch(input);
        } catch { }
    }

    if (!targetMessage) {
        const text = input;
        const urlRegex = /^(https?:\/\/[^\s]+)$/;
        const urlMatch = text.match(urlRegex);
        const isUrl = !!urlMatch;
        const isGif = isUrl && (text.endsWith('.gif') || text.includes('giphy') || text.includes('tenor')) || text.includes('klipy');

        const options: QuoteOptions = {
            content: isUrl ? '' : text,
            username: interaction.user.username,
            avatarUrl: interaction.user.displayAvatarURL({ extension: 'png', size: 128 }),
            userColor: (interaction.member as GuildMember)?.displayHexColor || '#000000',
            timestamp: new Date(),
            attachmentUrl: isUrl ? text : undefined,
            isGif: isGif
        };

        const buffer = await generateQuote(options);
        const attachment = new AttachmentBuilder(buffer, { name: isGif ? 'quote.gif' : 'quote.png' });
        await interaction.editReply({ files: [attachment] });
        return;
    }

    const attachment = targetMessage.attachments.first();
    let isGif = attachment?.contentType?.includes('gif') || false;
    let attachmentUrl = attachment?.url;

    if (!attachmentUrl) {
        const match = targetMessage.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif)|https?:\/\/media\.giphy\.com[^\s]+)/i);
        if (match) {
            attachmentUrl = match[0];
            if (attachmentUrl.includes('.gif') || attachmentUrl.includes('giphy')) {
                isGif = true;
            }
        }
    }

    let cleanContent = targetMessage.content;
    if (attachmentUrl) {
        cleanContent = targetMessage.content.replace(attachmentUrl, '').trim();
    }

    const options: QuoteOptions = {
        content: cleanContent,
        username: targetMessage.author.username,
        avatarUrl: targetMessage.author.displayAvatarURL({ extension: 'png', size: 128 }),
        userColor: targetMessage.member?.displayHexColor || '#5865F2',
        timestamp: targetMessage.createdAt,
        attachmentUrl: attachmentUrl,
        isGif: isGif
    };

    const buffer = await generateQuote(options);
    const resultAttachment = new AttachmentBuilder(buffer, { name: isGif ? 'quote.gif' : 'quote.png' });
    await interaction.editReply({ files: [resultAttachment] });
}
