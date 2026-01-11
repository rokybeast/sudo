import { Client, GatewayIntentBits, Events, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { Command, SlashCommand } from './types';

import fs from 'fs';
import path from 'path';

config();
// for that VIM baby
const PREFIX = '::';

declare module 'discord.js' {
    interface Client {
        commands: Collection<string, Command>;
        slashCommands: Collection<string, SlashCommand>;
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

// initialize command collections
client.commands = new Collection<string, Command>();
client.slashCommands = new Collection<string, SlashCommand>();

const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));
const slashCommandData: any[] = [];

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath);

    // register command and aliases
    if ('name' in command && 'execute' in command) {
        client.commands.set(command.name, command);
        if (command.aliases && Array.isArray(command.aliases)) {
            command.aliases.forEach((alias: string) => {
                client.commands.set(alias, command);
            });
        }
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
    }

    if ('data' in command && 'executeSlash' in command) {
        client.slashCommands.set(command.data.name, command);
        slashCommandData.push(command.data.toJSON());
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "executeSlash" property.`);
    }
}

// bot ready event
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[OK]: Logged in as ${readyClient.user.tag}`);
    console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);

    // register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);

    try {
        console.log('[INFO]: Registering slash commands...');
        await rest.put(Routes.applicationCommands(readyClient.user.id), {
            body: slashCommandData,
        });
        console.log('[OK]: Slash commands registered successfully!');
    } catch (error) {
        console.error('[ERROR]: Failed to register slash commands:', error);
    }
});

// prefix command handler
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        await command.execute(message, args);
    } catch (error) {
        console.error(`[ERROR]: Error executing command ${commandName}:`, error);
        await message.reply('[ERROR]: There was an error executing that command!');
    }
});

// slash command handler
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.executeSlash(interaction);
    } catch (error) {
        console.error(`[ERROR]: Error executing slash command ${interaction.commandName}:`, error);
        const errorMessage = '[ERROR]: There was an error executing that command!';
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: errorMessage, ephemeral: true });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
