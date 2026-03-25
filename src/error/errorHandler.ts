import { Message, ChatInputCommandInteraction } from "discord.js";

export async function handleCommandError(error: unknown, context: Message | ChatInputCommandInteraction, commandName: string) {
  console.error(`[ERROR]: Error executing command ${commandName}:`, error);

  let errorMessage = `[BotError]: An unexpected error occurred.`;
  if (error instanceof Error) {
    errorMessage = `[${commandName}]: ${error.message}`;
  }

  try {
    if ("isChatInputCommand" in context && context.isChatInputCommand()) {
      if (context.replied || context.deferred) {
        await context.followUp({ content: errorMessage, ephemeral: true });
      } else {
        await context.reply({ content: errorMessage, ephemeral: true });
      }
    } else {
      await (context as Message).reply(errorMessage);
    }
  } catch (replyError) {
    console.error("[ERROR]: Failed to send error message:", replyError);
  }
}
