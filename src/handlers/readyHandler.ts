import { Client, Events, REST, Routes } from "discord.js";
import { slashCommandData } from "./commandLoader";
import chalk from "chalk";

export function handleReady(client: Client) {
  client.once(Events.ClientReady, async (readyClient) => {
    console.log(chalk.green(`\n[OK] Logged in as ${chalk.bold(readyClient.user.tag)}`));
    console.log(chalk.cyan(`[INFO] Serving ${chalk.bold(readyClient.guilds.cache.size)} guild(s)`));

    const rest = new REST({ version: "10" }).setToken(process.env.TOKEN!);

    try {
      console.log(chalk.cyan("[INFO] Registering slash commands..."));
      await rest.put(Routes.applicationCommands(readyClient.user.id), {
        body: slashCommandData,
      });
      console.log(chalk.green("[OK] Slash commands registered successfully!\n"));
    } catch (error) {
      console.error(chalk.red("[ERROR] Failed to register slash commands:"), error);
    }
  });
}
