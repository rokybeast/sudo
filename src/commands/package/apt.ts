import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'apt';
export const description = 'Search for a package in the Debian/Ubuntu repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface DebianPackage {
    package: string;
    version: string;
    description: string;
    homepage?: string;
    section: string;
    priority: string;
    maintainer: string;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchApt(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchApt(interaction, pkgName);
}

async function searchApt(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://sources.debian.org/api/search/${encodeURIComponent(pkgName)}/`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data.results || data.results.other.length === 0) {
            const reply = `E: Unable to locate package ${pkgName}`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const pkg = data.results.other[0];

        const infoUrl = `https://sources.debian.org/api/src/${pkg.name}/`;
        const infoRes = await fetch(infoUrl);
        const infoData = await infoRes.json() as any;

        const latestVersion = infoData.versions?.[0];
        const installCmd = `sudo apt install ${pkg.name}`;

        const embed = new EmbedBuilder()
            .setTitle(`${pkg.name} ${latestVersion?.version || 'unknown'}`)
            .setURL(`https://packages.debian.org/search?keywords=${pkg.name}`)
            .setDescription(latestVersion?.area || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Suite', value: latestVersion?.suites?.join(', ') || 'Unknown', inline: true },
                { name: 'Area', value: latestVersion?.area || 'Unknown', inline: true },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'Debian Packages' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Apt error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[apt]: ${errorMessage}`);
        else await context.editReply(`[apt]: ${errorMessage}`);
    }
}
