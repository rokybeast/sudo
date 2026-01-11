import { Client, GatewayIntentBits, Events, Collection, REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { Command, SlashCommand } from './types';

// import commands
import * as pingCommand from './commands/ping';
import * as echoCommand from './commands/echo';

config();
// for that VIM baby
const PREFIX = ':';

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

// register prefix commands
const prefixCommands: Command[] = [pingCommand, echoCommand];
for (const cmd of prefixCommands) {
    client.commands.set(cmd.name, cmd);
}

// register slash commands
const slashCommands: SlashCommand[] = [pingCommand, echoCommand];
for (const cmd of slashCommands) {
    client.slashCommands.set(cmd.data.name, cmd);
}

// bot ready event
client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[OK]: Logged in as ${readyClient.user.tag}`);
    console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);

    // register slash commands
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN!);
    const commandData = slashCommands.map((cmd) => cmd.data.toJSON());

    try {
        console.log('[INFO]: Registering slash commands...');
        await rest.put(Routes.applicationCommands(readyClient.user.id), {
            body: commandData,
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
