import { Message } from 'discord.js';
import { isOwner } from '../../../index';

export const name = 'shutdown';
export const description = 'Shutdown the bot';
export const aliases = ['stop', 'exit'];

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error('This command is restricted to the sudoers only');
    }

    await message.reply('[botctl/info]: executed proccess `shutdown`');
    await new Promise((resolve) => setTimeout(resolve, 500));

    process.exit(0);
}
