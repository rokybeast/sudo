import { Message } from 'discord.js';
import { isOwner, loadFolder, getCommandFolders } from '../../../index';

export const name = 'load';
export const description = 'Load a command folder';
export const aliases = [];

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error('This command is restricted to the sudoers only');
    }

    if (args.length === 0) {
        const folders = getCommandFolders();
        throw new Error(`Usage: load <unit>\nAvailable Units: ${folders.join(', ')}`);
    }

    const unitName = args[0].toLowerCase();
    const folders = getCommandFolders();

    if (!folders.includes(unitName)) {
        throw new Error(`Unit '${unitName}' not found.\nAvailable units: ${folders.join(', ')}`);
    }

    const result = loadFolder(unitName);

    let response = '';

    if (result.loaded.length > 0) {
        response = `botctl: **${result.loaded.length}** commands from unit \`${unitName}/\`:\n\`${result.loaded.join('`, `')}\``;
    } else {
        response = `[botctl/error]: No commands loaded from unit \`${unitName}/\``;
    }

    if (result.errors.length > 0) {
        response += `\n[botctl/error]:\n\`\`\`\n${result.errors.join('\n')}\n\`\`\``;
    }

    await message.reply(response);
}
