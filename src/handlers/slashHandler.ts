import { Interaction } from "discord.js";
import { client } from "../index";
import { handleCommandError } from "../error/errorHandler";

export async function handleSlashCommand(interaction: Interaction) {
  if (!interaction.isChatInputCommand()) return;

  const command = client.slashCommands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.executeSlash(interaction);
  } catch (error) {
    await handleCommandError(error, interaction, interaction.commandName);
  }
}
