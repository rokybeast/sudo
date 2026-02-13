import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'zypper';
export const description = 'Search for a package in the openSUSE repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface OpenSUSEPackage {
    name: string;
    version: string;
    summary: string;
    description: string;
    url: string;
    license: string;
    project: string;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchZypper(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchZypper(interaction, pkgName);
}

async function searchZypper(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://build.opensuse.org/search/package?match=contains(@name,'${encodeURIComponent(pkgName)}')`;
        const apiUrl = `https://software.opensuse.org/search/json?q=${encodeURIComponent(pkgName)}&baseproject=openSUSE:Factory`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data || data.length === 0) {
            const reply = `No matching items found: '${pkgName}'`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const exactMatch = data.find((p: any) => p.name === pkgName);
        const pkg = exactMatch || data[0];

        const installCmd = `sudo zypper install ${pkg.name}`;

        const embed = new EmbedBuilder()
            .setTitle(`${pkg.name} ${pkg.version || ''}`)
            .setURL(`https://software.opensuse.org/package/${pkg.name}`)
            .setDescription(pkg.summary || pkg.description || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Project', value: pkg.project || 'openSUSE:Factory', inline: true },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'openSUSE Packages' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Zypper error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[zypper]: ${errorMessage}`);
        else await context.editReply(`[zypper]: ${errorMessage}`);
    }
}
