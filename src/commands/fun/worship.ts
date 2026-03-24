import { Message, ChatInputCommandInteraction, SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import fetch from 'node-fetch';
import GIFEncoder from 'gifencoder';
import gifFrames from 'gif-frames';

export const name = 'worship';
export const description = 'Worship a user with a glorious GIF';
export const aliases = ['pray'];

const WORSHIP_GIF = 'https://media.giphy.com/media/K55exy0toWjQc/giphy.gif';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addUserOption((option) =>
        option
            .setName('user')
            .setDescription('The user to worship')
            .setRequired(true)
    );

async function generateWorshipGif(avatarUrl: string): Promise<Buffer> {
    const avatarResponse = await fetch(avatarUrl);
    const avatarBuffer = Buffer.from(await avatarResponse.arrayBuffer());
    const avatarImage = await loadImage(avatarBuffer);

    const frameData = await gifFrames({
        url: WORSHIP_GIF,
        frames: 'all',
        outputType: 'png',
        cumulative: true,
    });

    if (frameData.length === 0) {
        throw new Error('Failed to extract frames from worship GIF');
    }

    const gifWidth = frameData[0].frameInfo.width;
    const gifHeight = frameData[0].frameInfo.height;

    const avatarSize = Math.round(gifWidth * 0.25);
    const avatarX = Math.round((gifWidth - avatarSize) / 2);
    const avatarY = Math.round(gifHeight * 0.05);

    const encoder = new GIFEncoder(gifWidth, gifHeight);
    const stream = encoder.createReadStream();

    const chunks: any[] = [];
    const bufferPromise = new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk: any) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
    });

    encoder.start();
    encoder.setRepeat(0);
    encoder.setQuality(10);
    encoder.setTransparent(0x00000000);

    const canvas = createCanvas(gifWidth, gifHeight);
    const ctx = canvas.getContext('2d');

    for (const frame of frameData) {
        const frameStream = frame.getImage();
        const frameParts: any[] = [];
        const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
            frameStream.on('data', (p: any) => frameParts.push(p));
            frameStream.on('end', () => resolve(Buffer.concat(frameParts)));
            frameStream.on('error', reject);
        });

        const frameImg = await loadImage(frameBuffer);

        if (frame.frameInfo && frame.frameInfo.delay) {
            encoder.setDelay(frame.frameInfo.delay * 10);
        } else {
            encoder.setDelay(100);
        }

        ctx.clearRect(0, 0, gifWidth, gifHeight);
        ctx.drawImage(frameImg, 0, 0, gifWidth, gifHeight)

        ctx.save();
        ctx.beginPath();
        ctx.arc(
            avatarX + avatarSize / 2,
            avatarY + avatarSize / 2,
            avatarSize / 2,
            0,
            Math.PI * 2
        );
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
            avatarX + avatarSize / 2,
            avatarY + avatarSize / 2,
            avatarSize / 2,
            0,
            Math.PI * 2
        );
        ctx.stroke();

        encoder.addFrame(ctx as any);
    }

    encoder.finish();
    return bufferPromise;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const mentionedUser = message.mentions.users.first();

    if (!mentionedUser) {
        throw new Error('Please mention a user to worship: `::worship @user`');
    }

    const avatarUrl = mentionedUser.displayAvatarURL({ extension: 'png', size: 128 });
    const buffer = await generateWorshipGif(avatarUrl);
    const attachment = new AttachmentBuilder(buffer, { name: 'worship.gif' });

    await message.reply({ files: [attachment] });
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();

    const user = interaction.options.getUser('user', true);
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 128 });

    const buffer = await generateWorshipGif(avatarUrl);
    const attachment = new AttachmentBuilder(buffer, { name: 'worship.gif' });

    await interaction.editReply({ files: [attachment] });
}
