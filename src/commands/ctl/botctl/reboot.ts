import { Message } from "discord.js";
import { isOwner } from "../../../index";
import path from "path";
import fs from "fs";

export const name = "reboot";
export const description = "Hard reboot the bot";
export const aliases = ["restart"];

export async function execute(message: Message, args: string[]): Promise<void> {
  if (!isOwner(message.author.id)) {
    throw new Error("This command is restricted to the sudoers only");
  }

  const entryFile = path.resolve(__dirname, "..", "..", "..", "index.ts");

  await message.reply("[botctl/info]: executed proccess `reboot`");

  try {
    const now = new Date();
    fs.utimesSync(entryFile, now, now);
  } catch (error) {
    throw new Error(
      `Failed to trigger restart: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
