import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'xbps';
export const description = 'Search for a package in the Void Linux repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface VoidPackage {
    name: string;
    version: string;
    revision: number;
    short_desc: string;
    homepage: string;
    license: string;
    maintainer: string;
    repository: string;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchXbps(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchXbps(interaction, pkgName);
}

async function searchXbps(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://voidlinux.org/packages/search?q=${encodeURIComponent(pkgName)}`;
        const apiUrl = `https://xq-api.voidlinux.org/v1/query/x86_64?q=${encodeURIComponent(pkgName)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data.data || data.data.length === 0) {
            const reply = `Package '${pkgName}' not found`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const exactMatch = data.data.find((p: VoidPackage) => p.name === pkgName);
        const pkg = exactMatch || data.data[0];

        const installCmd = `sudo xbps-install ${pkg.name}`;

        const embed = new EmbedBuilder()
            .setTitle(`${pkg.name} ${pkg.version}_${pkg.revision}`)
            .setURL(`https://voidlinux.org/packages/?q=${pkg.name}`)
            .setDescription(pkg.short_desc || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Repository', value: pkg.repository || 'Unknown', inline: true },
                { name: 'License', value: pkg.license || 'Unknown', inline: true },
                { name: 'Maintainer', value: pkg.maintainer || 'Unknown', inline: true },
                { name: 'Homepage', value: pkg.homepage || 'None', inline: false },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'Void Linux Packages' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Xbps error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[xbps]: ${errorMessage}`);
        else await context.editReply(`[xbps]: ${errorMessage}`);
    }
}
