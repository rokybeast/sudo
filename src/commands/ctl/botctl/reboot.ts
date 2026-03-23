import { Message, Events } from "discord.js";
import { isOwner, client } from "../../../index";
import path from "path";
import fs from "fs";

export const name = "reboot";
export const description = "Hard reboot the bot";
export const aliases = ["restart"];

const REBOOT_INFO_PATH = path.resolve(__dirname, "..", "..", "..", ".reboot-info.json")
if (fs.existsSync(REBOOT_INFO_PATH)) {
  const rebootInfo = JSON.parse(fs.readFileSync(REBOOT_INFO_PATH, "utf-8"));
  fs.unlinkSync(REBOOT_INFO_PATH);

  client.once(Events.ClientReady, async (readyClient) => {
    try {
      const channel = await readyClient.channels.fetch(rebootInfo.channelId);

      if (channel && channel.isTextBased() && "messages" in channel) {
        const message = await channel.messages.fetch(rebootInfo.messageId);
        await message.edit("[botctl/info]: successfully completed proccess `reboot`");
        console.log("[OK]: Reboot message updated successfully");
      }
    } catch (error) {
      console.error("[ERROR]: Failed to update reboot message:", error);
    }
  });
}

export async function execute(message: Message, args: string[]): Promise<void> {
  if (!isOwner(message.author.id)) {
    throw new Error("This command is restricted to the sudoers only");
  }

  const entryFile = path.resolve(__dirname, "..", "..", "..", "index.ts");

  const reply = await message.reply("[botctl/info]: executed proccess `reboot`");

  fs.writeFileSync(
    REBOOT_INFO_PATH,
    JSON.stringify({ channelId: reply.channelId, messageId: reply.id })
  );

  try {
    const now = new Date();
    fs.utimesSync(entryFile, now, now);
  } catch (error) {
    throw new Error(
      `Failed to trigger restart: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}
