import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'apk';
export const description = 'Search for a package in the Alpine Linux repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface AlpinePackage {
    name: string;
    version: string;
    description: string;
    url: string;
    license: string;
    origin: string;
    branch: string;
    repo: string;
    arch: string;
    maintainer: string;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchApk(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchApk(interaction, pkgName);
}

async function searchApk(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://pkgs.alpinelinux.org/packages?name=${encodeURIComponent(pkgName)}&branch=edge&repo=&arch=&maintainer=`;
        const apiUrl = `https://pkgs.alpinelinux.org/package/edge/main/x86_64/${encodeURIComponent(pkgName)}`;

        const searchUrl = `https://pkgs.alpinelinux.org/packages?name=${encodeURIComponent(pkgName)}&branch=edge`;

        const installCmd = `apk add ${pkgName}`;

        const embed = new EmbedBuilder()
            .setTitle(pkgName)
            .setURL(`https://pkgs.alpinelinux.org/packages?name=${pkgName}`)
            .setDescription('Alpine Linux package')
            .setColor(0x000000)
            .addFields(
                { name: 'Branch', value: 'edge', inline: true },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'Alpine Linux Packages' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Apk error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[apk]: ${errorMessage}`);
        else await context.editReply(`[apk]: ${errorMessage}`);
    }
}
