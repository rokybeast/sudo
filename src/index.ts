import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  REST,
  Routes,
} from "discord.js";
import { config } from "dotenv";
import { Command, SlashCommand } from "./types";
import { prefix, owners } from "./config/config.json";

import fs from "fs";
import path from "path";

config();

declare module "discord.js" {
  interface Client {
    commands: Collection<string, Command>;
    slashCommands: Collection<string, SlashCommand>;
  }
}

export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

// initialize command collections
client.commands = new Collection<string, Command>();
client.slashCommands = new Collection<string, SlashCommand>();

const commandsPath = path.join(__dirname, "commands");
const slashCommandData: any[] = [];

const loadedFolders = new Set<string>();

export function loadFolder(folderName: string): { loaded: string[]; errors: string[] } {
  const folderPath = path.join(commandsPath, folderName);
  const loaded: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    errors.push(`Folder '${folderName}' does not exist`);
    return { loaded, errors };
  }

  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);

    delete require.cache[require.resolve(filePath)];

    try {
      const command = require(filePath);

      if ("name" in command && "execute" in command) {
        client.commands.set(command.name, command);
        if (command.aliases && Array.isArray(command.aliases)) {
          command.aliases.forEach((alias: string) => {
            client.commands.set(alias, command);
          });
        }
        loaded.push(command.name);
      } else {
        errors.push(`${file}: missing name/execute`);
      }

      if ("data" in command && "executeSlash" in command) {
        client.slashCommands.set(command.data.name, command);
      }
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  loadedFolders.add(folderName);
  return { loaded, errors };
}

export function unloadFolder(folderName: string): { unloaded: string[]; errors: string[] } {
  const folderPath = path.join(commandsPath, folderName);
  const unloaded: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    errors.push(`Folder '${folderName}' does not exist`);
    return { unloaded, errors };
  }

  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);

    try {
      const command = require(filePath);

      if ("name" in command) {
        client.commands.delete(command.name);
        if (command.aliases && Array.isArray(command.aliases)) {
          command.aliases.forEach((alias: string) => {
            client.commands.delete(alias);
          });
        }
        unloaded.push(command.name);
      }

      if ("data" in command) {
        client.slashCommands.delete(command.data.name);
      }

      delete require.cache[require.resolve(filePath)];
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  loadedFolders.delete(folderName);
  return { unloaded, errors };
}

export function reloadAllCommands(): { total: number; units: number; errors: string[] } {
  const errors: string[] = [];

  client.commands.clear();
  client.slashCommands.clear();
  loadedFolders.clear();

  const folders = fs.readdirSync(commandsPath).filter((item) => {
    const itemPath = path.join(commandsPath, item);
    return fs.statSync(itemPath).isDirectory();
  });

  let total = 0;

  for (const folder of folders) {
    const result = loadFolder(folder);
    total += result.loaded.length;
    errors.push(...result.errors);
  }

  return { total, units: folders.length, errors };
}


export function getCommandFolders(): string[] {
  return fs.readdirSync(commandsPath).filter((item) => {
    const itemPath = path.join(commandsPath, item);
    return fs.statSync(itemPath).isDirectory();
  });
}

export function isOwner(userId: string): boolean {
  return owners.includes(userId);
}

console.log("\nLoading commands...\n");

const folders = getCommandFolders();
let totalCommands = 0;
const totalFolders = folders.length;

for (let i = 0; i < folders.length; i++) {
  const folder = folders[i];
  const folderPath = path.join(commandsPath, folder);
  const commandFiles = fs
    .readdirSync(folderPath)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

  let folderCommandCount = 0;

  for (const file of commandFiles) {
    const filePath = path.join(folderPath, file);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const command = require(filePath);

    // register command and aliases
    if ("name" in command && "execute" in command) {
      client.commands.set(command.name, command);
      if (command.aliases && Array.isArray(command.aliases)) {
        command.aliases.forEach((alias: string) => {
          client.commands.set(alias, command);
        });
      }
      folderCommandCount++;
    } else {
      console.log(
        `  [WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`,
      );
    }

    if ("data" in command && "executeSlash" in command) {
      client.slashCommands.set(command.data.name, command);
      slashCommandData.push(command.data.toJSON());
    } else {
      console.log(
        `  [WARNING] The command at ${filePath} is missing a required "data" or "executeSlash" property.`,
      );
    }
  }

  loadedFolders.add(folder);
  totalCommands += folderCommandCount;
  console.log(
    `[${i + 1}/${totalFolders}] ${folder}/ → ${folderCommandCount} command${folderCommandCount !== 1 ? "s" : ""} loaded`,
  );
}

console.log(`\nAll folders loaded (${totalCommands} commands total)\n`);

// bot ready event
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[OK]: Logged in as ${readyClient.user.tag}`);
  console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);

  // register slash commands
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

  try {
    console.log("[INFO]: Registering slash commands...");
    await rest.put(Routes.applicationCommands(readyClient.user.id), {
      body: slashCommandData,
    });
    console.log("[OK]: Slash commands registered successfully!");
  } catch (error) {
    console.error("[ERROR]: Failed to register slash commands:", error);
  }
});

// prefix command handler
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = client.commands.get(commandName);
  if (!command) {
    await message.reply(`[BotError]: Command not found: ${commandName}`);
    return;
  }

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`[ERROR]: Error executing command ${commandName}:`, error);

    let errorMessage = `[BotError]: An unexpected error occurred.`;
    if (error instanceof Error) {
      errorMessage = `[${commandName}]: ${error.message}`;
    }

    await message.reply(errorMessage);
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
    console.error(
      `[ERROR]: Error executing slash command ${interaction.commandName}:`,
      error,
    );
    const errorMessage = "[ERROR]: There was an error executing that command!";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content: errorMessage, ephemeral: true });
    } else {
      await interaction.reply({ content: errorMessage, ephemeral: true });
    }
  }
});

client.login(process.env.TOKEN);
