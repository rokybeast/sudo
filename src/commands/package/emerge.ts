import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'emerge';
export const description = 'Search for a package in the Gentoo repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface GentooPackage {
    atom: string;
    category: string;
    name: string;
    version: string;
    description: string;
    homepage: string;
    licenses: string[];
    maintainers: { name: string; email: string }[];
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchEmerge(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchEmerge(interaction, pkgName);
}

async function searchEmerge(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://packages.gentoo.org/packages/search.json?q=${encodeURIComponent(pkgName)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data.packages || data.packages.length === 0) {
            const reply = `!!! No packages found matching: ${pkgName}`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const exactMatch = data.packages.find((p: any) => p.name === pkgName);
        const pkg = exactMatch || data.packages[0];

        const installCmd = `sudo emerge ${pkg.category}/${pkg.name}`;
        const maintainers = pkg.maintainers?.map((m: any) => m.name || m.email).join(', ') || 'Unknown';

        const embed = new EmbedBuilder()
            .setTitle(`${pkg.category}/${pkg.name}`)
            .setURL(`https://packages.gentoo.org/packages/${pkg.category}/${pkg.name}`)
            .setDescription(pkg.description || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Category', value: pkg.category, inline: true },
                { name: 'License', value: pkg.licenses?.join(', ') || 'Unknown', inline: true },
                { name: 'Maintainers', value: maintainers.length > 1024 ? maintainers.slice(0, 1021) + '...' : maintainers, inline: false },
                { name: 'Homepage', value: pkg.homepage || 'None', inline: false },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'Gentoo Packages' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Emerge error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[emerge]: ${errorMessage}`);
        else await context.editReply(`[emerge]: ${errorMessage}`);
    }
}
