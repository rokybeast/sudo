import fs from "fs";
import path from "path";
import { Client, REST, Routes } from "discord.js";
import { client } from "../index";

const commandsPath = path.join(__dirname, "../commands");
export const slashCommandData: any[] = [];
export const loadedFolders = new Set<string>();

export function getCommandFolders(): string[] {
  return fs.readdirSync(commandsPath).filter((item) => {
    const itemPath = path.join(commandsPath, item);
    return fs.statSync(itemPath).isDirectory();
  });
}

function getCommandFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      files.push(...getCommandFilesRecursive(itemPath));
    } else if (item.endsWith(".ts") || item.endsWith(".js")) {
      files.push(itemPath);
    }
  }

  return files;
}

export function loadFolder(folderName: string): { loaded: string[]; errors: string[] } {
  const folderPath = path.join(commandsPath, folderName);
  const loaded: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    errors.push(`Folder '${folderName}' does not exist`);
    return { loaded, errors };
  }

  const commandFiles = getCommandFilesRecursive(folderPath);

  for (const filePath of commandFiles) {
    delete require.cache[require.resolve(filePath)];

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
        errors.push(`${path.basename(filePath)}: missing name/execute`);
      }

      if ("data" in command && "executeSlash" in command) {
        client.slashCommands.set(command.data.name, command);
      }
    } catch (err) {
      errors.push(`${path.basename(filePath)}: ${err instanceof Error ? err.message : 'unknown error'}`);
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

  const commandFiles = getCommandFilesRecursive(folderPath);

  for (const filePath of commandFiles) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
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
      errors.push(`${path.basename(filePath)}: ${err instanceof Error ? err.message : 'unknown error'}`);
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
  slashCommandData.length = 0; // Clear the array

  const folders = getCommandFolders();

  let total = 0;

  for (const folder of folders) {
    const result = loadFolder(folder);
    total += result.loaded.length;
    errors.push(...result.errors);
  }

  return { total, units: folders.length, errors };
}

export function initCommands(client: Client) {
  console.log("\nLoading commands...\n");
  const folders = getCommandFolders();
  let totalCommands = 0;
  const totalFolders = folders.length;

  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const folderPath = path.join(commandsPath, folder);
    const commandFiles = getCommandFilesRecursive(folderPath);

    let folderCommandCount = 0;

    for (const filePath of commandFiles) {
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
        console.log(`  [WARNING] The command at ${filePath} is missing a required "name" or "execute" property.`);
      }

      if ("data" in command && "executeSlash" in command) {
        client.slashCommands.set(command.data.name, command);
        slashCommandData.push(command.data.toJSON());
      } else {
        console.log(`  [WARNING] The command at ${filePath} is missing a required "data" or "executeSlash" property.`);
      }
    }

    loadedFolders.add(folder);
    totalCommands += folderCommandCount;
    console.log(`[${i + 1}/${totalFolders}] ${folder}/ → ${folderCommandCount} command${folderCommandCount !== 1 ? "s" : ""} loaded`);
  }

  console.log(`\nAll folders loaded (${totalCommands} commands total)\n`);
}
