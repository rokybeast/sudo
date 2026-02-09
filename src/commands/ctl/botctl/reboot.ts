import { Message } from 'discord.js';
import { isOwner } from '../../../index';
import { spawn } from 'child_process';
import path from 'path';

export const name = 'reboot';
export const description = 'Hard reboot the bot';
export const aliases = ['restart'];

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error('This command is restricted to the sudoers only');
    }

    const projectDir = path.join(__dirname, '..', '..', '..', '..');
    const rebootBinary = path.join(__dirname, '..', '..', '..', 'lib', 'reboot');

    await message.reply('[botctl/info]: executed proccess `reboot`');

    await new Promise((resolve) => setTimeout(resolve, 500));

    const child = spawn(rebootBinary, [process.pid.toString(), projectDir], {
        detached: true,
        stdio: 'ignore',
    });

    child.unref();
}
