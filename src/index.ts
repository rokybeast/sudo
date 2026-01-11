import "dotenv/config";
import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`I'm ${client.user?.tag}, good luck!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const prefix = "~";

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  // ~echo any;
  if (command === "echo") {
    if (args.length === 0) {
      await message.reply("say *something*, goner.");
      return;
    }

    await message.reply(args.join(" "));
  }
});

client.login(process.env.TOKEN);

