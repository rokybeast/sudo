import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'dnf';
export const description = 'Search for a package in the Fedora repositories';

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('package')
            .setDescription('The package to search for')
            .setRequired(true)
    );

interface FedoraPackage {
    name: string;
    version: string;
    release: string;
    summary: string;
    description: string;
    url: string;
    license: string;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const queryArgs = args.filter(arg => !arg.startsWith('-'));

    if (queryArgs.length === 0) {
        throw new Error('Parameter not found: package name');
    }

    const pkgName = queryArgs[0];
    await searchDnf(message, pkgName);
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const pkgName = interaction.options.getString('package', true);
    await interaction.deferReply();
    await searchDnf(interaction, pkgName);
}

async function searchDnf(context: Message | ChatInputCommandInteraction, pkgName: string) {
    try {
        const url = `https://src.fedoraproject.org/api/0/projects?pattern=${encodeURIComponent(pkgName)}&short=true`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        const data = await response.json() as any;

        if (!data.projects || data.projects.length === 0) {
            const reply = `Error: No match for argument: ${pkgName}`;
            if (context instanceof Message) await context.reply(reply);
            else await context.editReply(reply);
            return;
        }

        const exactMatch = data.projects.find((p: any) => p.name === pkgName);
        const pkg = exactMatch || data.projects[0];

        const installCmd = `sudo dnf install ${pkg.name}`;

        const embed = new EmbedBuilder()
            .setTitle(pkg.name)
            .setURL(`https://src.fedoraproject.org/rpms/${pkg.name}`)
            .setDescription(pkg.description || 'No description provided.')
            .setColor(0x000000)
            .addFields(
                { name: 'Namespace', value: pkg.namespace || 'rpms', inline: true },
                { name: 'Installation', value: `\`${installCmd}\``, inline: false }
            )
            .setFooter({ text: 'Fedora Packages' });

        if (context instanceof Message) await context.reply({ embeds: [embed] });
        else await context.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Dnf error:', error);
        const errorMessage = 'An error occurred while searching.';
        if (context instanceof Message) await context.reply(`[dnf]: ${errorMessage}`);
        else await context.editReply(`[dnf]: ${errorMessage}`);
    }
}
