import { Message, ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder, GuildMember, TextChannel } from 'discord.js';
import { createCanvas, loadImage, Image } from '@napi-rs/canvas';
import fetch from 'node-fetch';
import GIFEncoder from 'gifencoder';
import gifFrames from 'gif-frames';
import { Stream } from 'stream';
import { parse as parseTwemoji } from 'twemoji-parser';

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

interface TextSpan {
    type: 'text' | 'emoji';
    content: string;
    url?: string;
}

function parseTextToSpans(text: string): TextSpan[] {
    const spans: TextSpan[] = [];
    const customEmojiRegex = /<(a?):(\w+):(\d+)>/g;
    let match;
    let lastIndex = 0;
    
    while ((match = customEmojiRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            spans.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        
        const animated = match[1] === 'a';
        const name = match[2];
        const id = match[3];
        const ext = animated ? 'gif' : 'png';
        const url = `https://cdn.discordapp.com/emojis/${id}.${ext}`;
        
        spans.push({ type: 'emoji', content: name, url });
        lastIndex = customEmojiRegex.lastIndex;
    }
    
    if (lastIndex < text.length) {
        spans.push({ type: 'text', content: text.substring(lastIndex) });
    }
    
    const finalSpans: TextSpan[] = [];
    for (const span of spans) {
        if (span.type === 'emoji') {
            finalSpans.push(span);
        } else {
            const twemojis = parseTwemoji(span.content);
            if (twemojis.length === 0) {
                finalSpans.push(span);
                continue;
            }
            
            let tLastIndex = 0;
            for (const te of twemojis) {
                if (te.indices[0] > tLastIndex) {
                    finalSpans.push({ type: 'text', content: span.content.substring(tLastIndex, te.indices[0]) });
                }
                finalSpans.push({ type: 'emoji', content: te.text, url: te.url });
                tLastIndex = te.indices[1];
            }
            
            if (tLastIndex < span.content.length) {
                finalSpans.push({ type: 'text', content: span.content.substring(tLastIndex) });
            }
        }
    }
    
    return finalSpans;
}

async function fetchEmojis(spans: TextSpan[]): Promise<Record<string, Image>> {
    const images: Record<string, Image> = {};
    const fetchPromises = spans
        .filter(s => s.type === 'emoji' && s.url && !images[s.url])
        .map(async (s) => {
            if (!s.url || images[s.url]) return;
            try {
                const res = await fetch(s.url);
                const buffer = Buffer.from(await res.arrayBuffer());
                const img = await loadImage(buffer);
                images[s.url] = img;
            } catch (e) {
                console.error("Failed to load emoji", s.url, e);
            }
        });
    await Promise.all(fetchPromises);
    return images;
}

interface WrappedLine {
    spans: TextSpan[];
    width: number;
}

function wrapTextWithEmojis(ctx: any, spans: TextSpan[], maxWidth: number, emojiSize: number): WrappedLine[] {
    const lines: WrappedLine[] = [];
    let currentLine: TextSpan[] = [];
    let currentLineWidth = 0;

    const pushLine = () => {
        lines.push({ spans: currentLine, width: currentLineWidth });
        currentLine = [];
        currentLineWidth = 0;
    };

    for (let span of spans) {
        if (span.type === 'emoji') {
             if (currentLineWidth + emojiSize > maxWidth && currentLineWidth > 0) {
                 pushLine();
             }
             currentLine.push({ type: 'emoji', content: span.content, url: span.url });
             currentLineWidth += emojiSize;
        } else {
             const paragraphs = span.content.split('\n');
             for (let i = 0; i < paragraphs.length; i++) {
                 if (i > 0) pushLine();
                 
                 const p = paragraphs[i];
                 if (!p && i < paragraphs.length - 1) continue;

                 const words = p.split(' ');
                 for (let j = 0; j < words.length; j++) {
                      let word = words[j];
                      if (j < words.length - 1) word += ' ';

                      if (!word) continue;

                      const cleanWordWidth = ctx.measureText(word.trimEnd()).width;
                      const wordWidth = ctx.measureText(word).width;

                      if (currentLineWidth + cleanWordWidth > maxWidth && currentLineWidth > 0) {
                          pushLine();
                      }
                      
                      currentLine.push({ type: 'text', content: word });
                      currentLineWidth += wordWidth;
                 }
             }
        }
    }

    if (currentLine.length > 0) pushLine();

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
    wrappedLines: WrappedLine[],
    attrLines: WrappedLine[],
    emojiImages: Record<string, Image>,
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
        let x = padding;
        for (const span of line.spans) {
            if (span.type === 'emoji') {
                if (span.url && emojiImages[span.url]) {
                    ctx.drawImage(emojiImages[span.url], x, y - fontSize + 4, fontSize, fontSize);
                }
                x += fontSize;
            } else {
                ctx.fillText(span.content, x, y);
                x += ctx.measureText(span.content).width;
            }
        }
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
        let x = padding;
        for (const span of line.spans) {
            if (span.type === 'emoji') {
                if (span.url && emojiImages[span.url]) {
                    ctx.drawImage(emojiImages[span.url], x, y - attrFontSize + 4, attrFontSize, attrFontSize);
                }
                x += attrFontSize;
            } else {
                ctx.fillText(span.content, x, y);
                x += ctx.measureText(span.content).width;
            }
        }
        y += attrLineHeight;
    }
}

async function resolveGifUrl(url: string, initialHtml?: string): Promise<string> {
    try {
        const html = initialHtml || await (await fetch(url)).text();
        const metaMatch = html.match(/<meta[^>]+(?:property="og:image"|name="twitter:image")[^>]+content="([^"]+\.gif[^"]*)"/i) 
                        || html.match(/<meta[^>]+content="([^"]+\.gif[^"]*)"[^>]+(?:property="og:image"|name="twitter:image")/i);
        if (metaMatch) return metaMatch[1];

        const tenorMatch = html.match(/(https:\/\/media\.tenor\.com\/[^\/]+\/[^"'\s]+\.gif)/i);
        if (tenorMatch) return tenorMatch[1];

        const giphyMatch = html.match(/(https:\/\/media\d*\.giphy\.com\/media\/[^"'\s]+\/giphy\.gif)/i);
        if (giphyMatch) return giphyMatch[1];
    } catch (e) {
        console.error("Failed to resolve true GIF URL", e);
    }
    return url;
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
    const spans = options.content ? parseTextToSpans(quotedContent) : [];
    const wrappedLines = wrapTextWithEmojis(tempCtx, spans, maxWidth - padding * 2, fontSize);
    const textHeight = wrappedLines.length * lineHeight;

    tempCtx.font = `${attrFontSize}px sans-serif`;
    const attrText = `- ${options.username}`;
    const attrSpans = parseTextToSpans(attrText);
    const attrLines = wrapTextWithEmojis(tempCtx, attrSpans, maxWidth - padding * 2, attrFontSize);
    const attrHeight = attrLines.length * attrLineHeight;

    const allSpans = [...spans, ...attrSpans];
    const emojiImages = await fetchEmojis(allSpans);

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
                let res = await fetch(options.attachmentUrl);
                let contentType = res.headers.get('content-type') || '';
                
                if (contentType.includes('text/html')) {
                    const html = await res.text();
                    options.attachmentUrl = await resolveGifUrl(options.attachmentUrl, html);
                    res = await fetch(options.attachmentUrl);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    contentType = res.headers.get('content-type') || '';
                } else if (!res.ok) {
                    throw new Error(`HTTP ${res.status}`);
                }

                if (!contentType.includes('gif')) {
                    // It is a webp, png, mp4 or something else, fall back to static image processing
                    options.isGif = false;
                    const imgBuffer = Buffer.from(await res.arrayBuffer());
                    attachmentImage = await loadImage(imgBuffer);
                    const displayWidth = maxWidth - (padding * 2);
                    const scale = displayWidth / attachmentImage.width;
                    attachmentHeight = attachmentImage.height * scale;
                } else {
                    const gifBuffer = Buffer.from(await res.arrayBuffer());
                    const frameData = await gifFrames({ url: gifBuffer, frames: 'all', outputType: 'png', cumulative: true });
                    frames = frameData;
                    if (frames.length > 0) {
                        const firstFrame = frames[0];
                        const width = firstFrame.frameInfo.width;
                        const height = firstFrame.frameInfo.height;

                        const displayWidth = maxWidth - (padding * 2);
                        const scale = displayWidth / width;
                        attachmentHeight = height * scale;
                    }
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

            await drawQuoteCard(ctx, maxWidth, Math.ceil(canvasHeight), options, avatarImage, dominantColor, wrappedLines, attrLines, emojiImages, frameImg, attachmentHeight);
            encoder.addFrame(ctx as any);
        }

        encoder.finish();
        return bufferPromise;

    } else {
        const canvas = createCanvas(maxWidth, Math.ceil(canvasHeight));
        const ctx = canvas.getContext('2d');
        await drawQuoteCard(ctx, maxWidth, Math.ceil(canvasHeight), options, avatarImage, dominantColor, wrappedLines, attrLines, emojiImages, attachmentImage, attachmentHeight);
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
            if (args.length > 0) {
                contentOverride = args.join(' ').trim();
            }
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
                    if (args.length > 1) contentOverride = args.slice(1).join(' ').trim();
                } catch { }
            }
        } else if (/^\d+$/.test(input)) {
            try {
                targetMessage = await (message.channel as TextChannel).messages.fetch(input);
                if (args.length > 1) contentOverride = args.slice(1).join(' ').trim();
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
    let isGif = attachment?.contentType?.includes('gif') || targetMessage.content.match(/https?:\/\/[^\s]+\.gif/i) !== null;
    let attachmentUrl = attachment?.url;

    if (!attachmentUrl) {
        const match = targetMessage.content.match(/(https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif)|https?:\/\/media\.giphy\.com[^\s]+)/i);
        if (match) {
            attachmentUrl = match[0];
            if (attachmentUrl.includes('.gif') || attachmentUrl.includes('giphy')) {
                isGif = true;
            }
        } else if (targetMessage.embeds && targetMessage.embeds.length > 0) {
            const embed = targetMessage.embeds[0];
            if (embed.video && embed.video.url && embed.video.url.includes('.gif')) {
                attachmentUrl = embed.video.url;
                isGif = true;
            } else if (embed.thumbnail && embed.thumbnail.url && embed.thumbnail.url.includes('.gif')) {
                attachmentUrl = embed.thumbnail.url;
                isGif = true;
            } else if (embed.image && embed.image.url) {
                attachmentUrl = embed.image.url;
                isGif = attachmentUrl.includes('.gif');
            }
        }
    }

    let cleanContent = '';
    if (contentOverride) {
        cleanContent = contentOverride;
    } else {
        cleanContent = targetMessage.content.replace(/(https?:\/\/[^\s]+(?:tenor\.com|giphy\.com|png|jpg|jpeg|gif|webp)[^\s]*)/ig, '').trim();
        if (attachmentUrl && cleanContent === targetMessage.content) {
            cleanContent = targetMessage.content.replace(attachmentUrl, '').trim();
        }
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
    let contentOverride: string | undefined;

    const linkMatch = input.match(/https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)/);
    if (linkMatch) {
        const [, guildId, channelId, msgId] = linkMatch;
        if (guildId === interaction.guildId) {
            try {
                const channel = await interaction.client.channels.fetch(channelId) as TextChannel;
                targetMessage = await channel.messages.fetch(msgId);
                const queryParts = input.split(/\s+/);
                if (queryParts.length > 1) contentOverride = queryParts.slice(1).join(' ').trim();
            } catch { }
        }
    } else if (/^\d+$/.test(input.split(/\s+/)[0])) {
        try {
            const queryParts = input.split(/\s+/);
            targetMessage = await (interaction.channel as TextChannel).messages.fetch(queryParts[0]);
            if (queryParts.length > 1) contentOverride = queryParts.slice(1).join(' ').trim();
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
        } else if (targetMessage.embeds && targetMessage.embeds.length > 0) {
            const embed = targetMessage.embeds[0];
            if (embed.video && embed.video.url && embed.video.url.includes('.gif')) {
                attachmentUrl = embed.video.url;
                isGif = true;
            } else if (embed.thumbnail && embed.thumbnail.url && embed.thumbnail.url.includes('.gif')) {
                attachmentUrl = embed.thumbnail.url;
                isGif = true;
            } else if (embed.image && embed.image.url) {
                attachmentUrl = embed.image.url;
                isGif = attachmentUrl.includes('.gif');
            }
        }
    }

    let cleanContent = '';
    if (contentOverride) {
        cleanContent = contentOverride;
    } else {
        cleanContent = targetMessage.content.replace(/(https?:\/\/[^\s]+(?:tenor\.com|giphy\.com|png|jpg|jpeg|gif|webp)[^\s]*)/ig, '').trim();
        if (attachmentUrl && cleanContent === targetMessage.content) {
            cleanContent = targetMessage.content.replace(attachmentUrl, '').trim();
        }
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
