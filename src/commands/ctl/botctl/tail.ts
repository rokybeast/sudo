import { Message } from "discord.js";
import { isOwner } from "../../../utils/permissions";
import fs from "fs";
import path from "path";

export const name = "tail";
export const description = "View recent bot terminal output";

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error("This command is restricted to bot owners only");
    }

    const logPath = path.resolve(process.cwd(), ".bot.log");
    if (!fs.existsSync(logPath)) {
        await message.reply("[botctl/info]: No terminal logs captured yet.");
        return;
    }

    const rawLogs = fs.readFileSync(logPath, "utf-8");
    const logs = rawLogs.split("\n").filter(Boolean);

    let loginIndex = -1;
    for (let i = logs.length - 1; i >= 0; i--) {
        if (logs[i].includes("Logged in as")) {
            loginIndex = i;
            break;
        }
    }

    const relevantLogs = loginIndex !== -1 ? logs.slice(loginIndex) : logs.slice(-20);
    const logText = relevantLogs.join("\n");
    
    let strippedLogText = logText.replace(/[\u001b\u009b][[()#;?]*(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~]*)*)?([a-zA-Z/<> head])/g, "");
    
    const output = `\`\`\`\n${strippedLogText.length > 1950 ? strippedLogText.slice(-1950) : strippedLogText}\n\`\`\``;

    await message.reply(`**Terminal Output (tail)**\n${output}`);
}
