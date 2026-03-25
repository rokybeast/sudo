import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
} from "discord.js";
import { config } from "dotenv";
import { Command, SlashCommand } from "./types";
import { handlePrefixCommand } from "./handlers/prefixHandler";
import { handleSlashCommand } from "./handlers/slashHandler";
import { initCommands } from "./handlers/commandLoader";
import { handleReady } from "./handlers/readyHandler";

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

client.commands = new Collection<string, Command>();
client.slashCommands = new Collection<string, SlashCommand>();

initCommands(client);
handleReady(client);

client.on(Events.MessageCreate, handlePrefixCommand);
client.on(Events.InteractionCreate, handleSlashCommand);

client.login(process.env.TOKEN);
