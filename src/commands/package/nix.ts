import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'nix';
export const description = 'Search for a package in the Nixpkgs repository';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface NixPackage {
    package_attr_name: string;
    package_pname: string;
    package_pversion: string;
    package_description: string;
    package_homepage: string[];
    package_license: { fullName: string }[];
    package_maintainers: { name: string }[];
    package_programs: string[];
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchNix(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchNix(interaction, pkgName);
}

async function searchNix(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://search.nixos.org/backend/latest-42-nixos-unstable/_search`;
        const body = {
            from: 0,
            size: 10,
            query: {
                bool: {
                    must: [
                        { match: { package_pname: pkgName } }
                    ]
                }
            }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Basic YVdWU0FMWHBadjpYOGdQSG56TDUyd0ZFZWt1eHNmUTljU2g='
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data.hits || data.hits.hits.length === 0) {
            const reply = `error: no results for package '${pkgName}'`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const exactMatch = data.hits.hits.find((h: any) => h._source.package_pname === pkgName);
        const hit = exactMatch || data.hits.hits[0];
        const pkg = hit._source;

        const installCmd = `nix-env -iA nixpkgs.${pkg.package_attr_name}`;
        const licenses = pkg.package_license?.map((l: any) => l.fullName).join(', ') || 'Unknown';
        const maintainers = pkg.package_maintainers?.map((m: any) => m.name).join(', ') || 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle(`${pkg.package_pname} ${pkg.package_pversion}`)
            .setURL(`https://search.nixos.org/packages?query=${pkg.package_pname}`)
            .setDescription(pkg.package_description || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Attribute', value: pkg.package_attr_name, inline: true },
                { name: 'License', value: licenses, inline: true },
                { name: 'Maintainers', value: maintainers.length > 1024 ? maintainers.slice(0, 1021) + '...' : maintainers, inline: false },
                { name: 'Homepage', value: pkg.package_homepage?.[0] || 'None', inline: false },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'Nixpkgs' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Nix error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[nix]: ${errorMessage}`);
        else await context.editReply(`[nix]: ${errorMessage}`);
    }
}
