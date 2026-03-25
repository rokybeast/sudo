import { Client, Events, REST, Routes } from "discord.js";
import { slashCommandData } from "./commandLoader";

export function handleReady(client: Client) {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[OK]: Logged in as ${readyClient.user.tag}`);
    console.log(`Serving ${readyClient.guilds.cache.size} guild(s)`);

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
}
