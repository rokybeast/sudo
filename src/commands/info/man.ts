import { Message, ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

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

export async function execute(message: Message, args: string[]): Promise<void> {
    const { commands } = message.client;

    if (!args.length) {
        const commandList = commands.map((cmd) => `\`${cmd.name}\``).join(', ');
        const embed = new EmbedBuilder()
            .setTitle('ManDB')
            .setDescription(`Here are the available commands:\n${commandList}\n\nUse \`::man <command>\` for more info.`)
            .setColor(0x0099ff);

        await message.reply({ embeds: [embed] });
        return;
    }

    const name = args[0].toLowerCase();
    const command = commands.get(name) || commands.find((c) => c.aliases && c.aliases.includes(name));

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
        const commandList = commands.map((cmd) => `\`${cmd.name}\``).join(', ');
        const embed = new EmbedBuilder()
            .setTitle('ManDB')
            .setDescription(`Here are the available commands:\n${commandList}\n\nUse \`/man <command>\` for more info.`)
            .setColor(0x000000);

        await interaction.reply({ embeds: [embed] });
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
