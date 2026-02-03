import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'pacman';
export const description = 'Search for a package in the Arch Linux official repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface ArchPackage {
    pkgname: string;
    pkgver: string;
    pkgrel: string;
    pkgdesc: string;
    url: string;
    licenses: string[];
    maintainers: string[];
    arch: string;
    repo: string;
    last_update: string;
}

interface ArchSearchResponse {
    version: number;
    results: ArchPackage[];
    valid: boolean;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchArch(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchArch(interaction, pkgName);
}

async function searchArch(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://archlinux.org/packages/search/json/?q=${encodeURIComponent(pkgName)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const searchData = await response.json() as ArchSearchResponse;

        const exactMatch = searchData.results.find(p => p.pkgname === pkgName);
        const searchResult = exactMatch || searchData.results[0];

        if (!searchResult) {
            const reply = `error: package '${pkgName}' was not found`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        let details: any = { ...searchResult };
        try {
            const detailUrl = `https://archlinux.org/packages/${searchResult.repo}/${searchResult.arch}/${searchResult.pkgname}/json/`;
            const detailRes = await fetch(detailUrl);
            if (detailRes.ok) {
                details = await detailRes.json();
            }
        } catch (e) {
            console.error('Failed to fetch details:', e);
        }

        const deps = details.depends ? details.depends.join(', ') : 'None';
        const installCmd = `sudo pacman -S ${details.pkgname}`;

        const embed = new EmbedBuilder()
            .setTitle(`${details.pkgname} ${details.pkgver}-${details.pkgrel}`)
            .setURL(`https://archlinux.org/packages/${details.repo}/${details.arch}/${details.pkgname}/`)
            .setDescription(details.pkgdesc || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Repository', value: details.repo, inline: true },
                { name: 'Architecture', value: details.arch, inline: true },
                { name: 'License', value: Array.isArray(details.licenses) ? details.licenses.join(', ') : 'Unknown', inline: true },
                { name: 'Maintainer', value: Array.isArray(details.maintainers) ? details.maintainers.join(', ') : 'Orphan', inline: true },
                { name: 'Upstream URL', value: details.url || 'None', inline: false },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false },
                { name: 'Dependencies', value: deps.length > 1024 ? deps.slice(0, 1021) + '...' : deps, inline: false },
                { name: 'Last Updated', value: details.last_update ? details.last_update.split('T')[0] : 'Unknown', inline: true }
            )
            .setFooter({ text: 'Arch Linux Official Repositories' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Pacman error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[pacman]: ${errorMessage}`);
        else await context.editReply(`[pacman]: ${errorMessage}`);
    }
}
