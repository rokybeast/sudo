import { Message, GuildMember } from 'discord.js';
import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
} from '@discordjs/voice';
import fetch from 'node-fetch';
import { Readable } from 'stream';

export const name = 'say';
export const description = 'Join voice channel and speak text using TTS';
export const aliases = ['tts', 'speak'];

const MAX_TEXT_LENGTH = 200;

async function getTTSStream(text: string): Promise<Readable> {
    const encodedText = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodedText}`;

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
    });

    if (!response.ok) {
        throw new Error('Failed to fetch TTS audio');
    }

    return Readable.from(response.body as any);
}

export async function execute(message: Message, args: string[]): Promise<void> {
    if (args.length === 0) {
        throw new Error('Usage: ::say <text>');
    }

    const text = args.join(' ');

    if (text.length > MAX_TEXT_LENGTH) {
        throw new Error(`Text too long (max ${MAX_TEXT_LENGTH} characters)`);
    }

    const member = message.member as GuildMember;
    if (!member?.voice?.channel) {
        throw new Error('You must be in a voice channel');
    }

    const voiceChannel = member.voice.channel;

    if (!voiceChannel.joinable) {
        throw new Error('Cannot join this voice channel');
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guild.id,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
    });

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 10_000);

        const stream = await getTTSStream(text);
        const resource = createAudioResource(stream);
        const player = createAudioPlayer();

        connection.subscribe(player);
        player.play(resource);


        player.on(AudioPlayerStatus.Idle, () => {
            connection.destroy();
        });

        player.on('error', (error) => {
            console.error('Audio player error:', error);
            connection.destroy();
        });

    } catch (error) {
        connection.destroy();
        throw error;
    }
}
