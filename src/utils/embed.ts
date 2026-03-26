import { EmbedBuilder, ColorResolvable } from 'discord.js';


export const globalEmbedColor: ColorResolvable = 0x000000;


export function createEmbed(): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(globalEmbedColor);
}
