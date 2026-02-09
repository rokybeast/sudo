import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'aur';
export const description = 'Search for a package in the AUR (Arch User Repository)';
export const aliases = ['yay', 'paru'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface AurPackage {
    Name: string;
    Version: string;
    Description: string;
    URL: string;
    License: string[];
    Maintainer: string | null;
    NumVotes: number;
    Popularity: number;
    FirstSubmitted: number;
    LastModified: number;
    OutOfDate: number | null;
    Depends?: string[];
}

interface AurSearchResponse {
    version: number;
    type: string;
    resultcount: number;
    results: AurPackage[];
    error?: string;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchAur(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchAur(interaction, pkgName);
}

async function searchAur(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://aur.archlinux.org/rpc/v5/info?arg[]=${encodeURIComponent(pkgName)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as AurSearchResponse;

        if (data.results.length === 0) {
            const reply = `error: package '${pkgName}' was not found`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const pkg = data.results[0];

        const deps = pkg.Depends ? pkg.Depends.join(', ') : 'None';
        const installCmd = `yay -S ${pkg.Name}`;

        const embed = new EmbedBuilder()
            .setTitle(`${pkg.Name} ${pkg.Version}`)
            .setURL(`https://aur.archlinux.org/packages/${pkg.Name}/`)
            .setDescription(pkg.Description || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Maintainer', value: pkg.Maintainer || 'Orphan', inline: true },
                { name: 'Votes', value: pkg.NumVotes.toString(), inline: true },
                { name: 'Popularity', value: pkg.Popularity.toFixed(2), inline: true },
                { name: 'License', value: pkg.License ? pkg.License.join(', ') : 'Unknown', inline: true },
                { name: 'Upstream URL', value: pkg.URL || 'None', inline: false },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false },
                { name: 'Dependencies', value: deps.length > 1024 ? deps.slice(0, 1021) + '...' : deps, inline: false },
                { name: 'Last Updated', value: new Date(pkg.LastModified * 1000).toISOString().split('T')[0], inline: true }
            )
            .setFooter({ text: 'Arch User Repository (AUR)' });

        if (pkg.OutOfDate) {
            embed.addFields({ name: 'Status', value: 'Flagged Out-of-Date', inline: true });
            embed.setColor(0x000000);
        }

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Yay error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[yay]: ${errorMessage}`);
        else await context.editReply(`[yay]: ${errorMessage}`);
    }
}
