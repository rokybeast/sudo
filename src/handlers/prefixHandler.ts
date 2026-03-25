import { Message } from "discord.js";
import { client } from "../index";
import { prefix } from "../config/config.json";
import { handleCommandError } from "../error/errorHandler";

export async function handlePrefixCommand(message: Message) {
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
    await handleCommandError(error, message, commandName);
  }
}
