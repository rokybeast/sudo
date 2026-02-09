import { Message } from 'discord.js';
import { isOwner, unloadFolder, getCommandFolders } from '../../../index';

export const name = 'unload';
export const description = 'Unload a command unit';
export const aliases = [];

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error('This command is restricted to the sudoers only');
    }

    if (args.length === 0) {
        const folders = getCommandFolders();
        throw new Error(`Usage: unload <unit>\nAvailable units: ${folders.join(', ')}`);
    }

    const unitName = args[0].toLowerCase();

    if (unitName === 'ctl') {
        throw new Error('Cannot unload the ctl unit');
    }

    const folders = getCommandFolders();

    if (!folders.includes(unitName)) {
        throw new Error(`Unit '${unitName}' not found.\nAvailable units: ${folders.join(', ')}`);
    }

    const result = unloadFolder(unitName);

    let response = '';

    if (result.unloaded.length > 0) {
        response = `[botctl/info]: Unloaded **${result.unloaded.length}** commands from \`${unitName}/\`:\n\`${result.unloaded.join('`, `')}\``;
    } else {
        response = `[botctl/warning]: No commands unloaded from \`${unitName}/\``;
    }

    if (result.errors.length > 0) {
        response += `\n[botctl/error]:\n\`\`\`\n${result.errors.join('\n')}\n\`\`\``;
    }

    await message.reply(response);
}
