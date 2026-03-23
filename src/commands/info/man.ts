import {
    Message,
    ChatInputCommandInteraction,
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    ComponentType,
} from 'discord.js';
import { getCommandFolders } from '../../index';
import fs from 'fs';
import path from 'path';

export const name = 'man';
export const description = 'Display the manual page for a command';
export const aliases = ['help'];

export const data = new SlashCommandBuilder()
    .setName(name)
    .setDescription(description)
    .addStringOption((option) =>
        option
            .setName('command')
            .setDescription('The command to look up')
            .setRequired(false)
    );

function getCommandsInFolder(folderName: string): string[] {
    const commandsPath = path.join(__dirname, '..');
    const folderPath = path.join(commandsPath, folderName);

    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
        return [];
    }

    function collectFiles(dir: string): string[] {
        const files: string[] = [];
        for (const item of fs.readdirSync(dir)) {
            const itemPath = path.join(dir, item);
            if (fs.statSync(itemPath).isDirectory()) {
                files.push(...collectFiles(itemPath));
            } else if (item.endsWith('.ts') || item.endsWith('.js')) {
                files.push(itemPath);
            }
        }
        return files;
    }

    const commandFiles = collectFiles(folderPath);
    const names: string[] = [];

    for (const filePath of commandFiles) {
        try {
            const command = require(filePath);
            if ('name' in command) {
                names.push(command.name);
            }
        } catch {
            // skip broken commands
        }
    }

    return names.sort((a, b) => a.localeCompare(b));
}

function buildFolderEmbed(folderName: string): EmbedBuilder {
    const cmds = getCommandsInFolder(folderName);
    const commandList = cmds.length > 0
        ? cmds.map((c) => `\`${c}\``).join(', ')
        : '_No commands found_';

    return new EmbedBuilder()
        .setTitle(`ManDB: ${folderName}/`)
        .setDescription(commandList)
        .setColor(0x000000)
        .setFooter({ text: `${cmds.length} command${cmds.length !== 1 ? 's' : ''}` });
}

function buildOverviewEmbed(folders: string[]): EmbedBuilder {
    const fields = folders.map((folder) => {
        const cmds = getCommandsInFolder(folder);
        return {
            name: `${folder}/`,
            value: cmds.length > 0
                ? cmds.map((c) => `\`${c}\``).join(', ')
                : '_No commands_',
            inline: false,
        };
    });

    return new EmbedBuilder()
        .setTitle('ManDB')
        .setDescription('Select a category from the dropdown below.')
        .addFields(fields)
        .setColor(0x000000);
}

function buildSelectMenu(folders: string[]): ActionRowBuilder<StringSelectMenuBuilder> {
    const select = new StringSelectMenuBuilder()
        .setCustomId('man_folder_select')
        .setPlaceholder('Select a category...')
        .addOptions(
            folders.map((folder) => ({
                label: folder,
                value: folder,
                description: `View commands in ${folder}/`,
            }))
        );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const { commands } = message.client;

    if (!args.length) {
        const folders = getCommandFolders().sort((a, b) => a.localeCompare(b));
        const embed = buildOverviewEmbed(folders);
        const row = buildSelectMenu(folders);

        const reply = await message.reply({ embeds: [embed], components: [row] });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60_000,
        });

        collector.on('collect', async (i: StringSelectMenuInteraction) => {
            if (i.user.id !== message.author.id) {
                await i.reply({ content: 'This menu is not for you.', ephemeral: true });
                return;
            }

            const selectedFolder = i.values[0];
            const folderEmbed = buildFolderEmbed(selectedFolder);

            await i.update({ embeds: [folderEmbed], components: [row] });
        });

        collector.on('end', async () => {
            try {
                await reply.edit({ components: [] });
            } catch {
                // message may have been deleted
            }
        });

        return;
    }

    const cmdName = args[0].toLowerCase();
    const command = commands.get(cmdName) || commands.find((c) => c.aliases && c.aliases.includes(cmdName));

    if (!command) {
        await message.reply('❌ No manual entry for that command.');
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`ManDB: ${command.name}`)
        .setDescription(command.description)
        .addFields(
            { name: 'Name', value: command.name, inline: true },
            { name: 'Description', value: command.description, inline: true },
            { name: 'Aliases', value: command.aliases ? command.aliases.map((a) => `\`${a}\``).join(', ') : 'None', inline: true }
        )
        .setColor(0x000000);

    await message.reply({ embeds: [embed] });
}

export async function executeSlash(interaction: ChatInputCommandInteraction): Promise<void> {
    const { commands } = interaction.client;
    const commandName = interaction.options.getString('command');

    if (!commandName) {
        const folders = getCommandFolders().sort((a, b) => a.localeCompare(b));
        const embed = buildOverviewEmbed(folders);
        const row = buildSelectMenu(folders);

        const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: 60_000,
        });

        collector.on('collect', async (i: StringSelectMenuInteraction) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'This menu is not for you.', ephemeral: true });
                return;
            }

            const selectedFolder = i.values[0];
            const folderEmbed = buildFolderEmbed(selectedFolder);

            await i.update({ embeds: [folderEmbed], components: [row] });
        });

        collector.on('end', async () => {
            try {
                await reply.edit({ components: [] });
            } catch {
                // interaction may have expired
            }
        });

        return;
    }

    const name = commandName.toLowerCase();
    const command = commands.get(name) || commands.find((c) => c.aliases && c.aliases.includes(name));

    if (!command) {
        await interaction.reply({ content: '❌ No manual entry for that command.', ephemeral: true });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`ManDB: ${command.name}`)
        .setDescription(command.description)
        .addFields(
            { name: 'Name', value: command.name, inline: true },
            { name: 'Description', value: command.description, inline: true },
            { name: 'Aliases', value: command.aliases ? command.aliases.map((a) => `\`${a}\``).join(', ') : 'None', inline: true }
        )
        .setColor(0x000000);

    await interaction.reply({ embeds: [embed] });
}
