import { Message } from 'discord.js';
import { isOwner, reloadAllCommands } from '../../../index';

export const name = 'reload';
export const description = 'Reload all commands';
export const aliases = ['rl'];

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error('This command is restricted to the sudoers only');
    }

    await message.reply('[botctl/info]: Reloading all commands from all units');

    const result = reloadAllCommands();

    let response = `[botctl/info]: Reloaded **${result.total}** commands from **${result.units}** units`;

    if (result.errors.length > 0) {
        response += `\n[botctl/error]:\n\`\`\`\n${result.errors.join('\n')}\n\`\`\``;
    }

    if (message.channel.isSendable()) {
        await message.channel.send(response);
    }
}
