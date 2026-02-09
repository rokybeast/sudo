import { Message } from 'discord.js';
import { isOwner, getCommandFolders } from '../../index';
import fs from 'fs';
import path from 'path';

export const name = 'ctl';
export const description = 'Bot control panel - shows available control commands';
export const aliases = ['control', 'botctl'];

interface CtlModule {
    name: string;
    description: string;
}

function getModulesFromFolder(unitPath: string): CtlModule[] {
    const modules: CtlModule[] = [];

    if (!fs.existsSync(unitPath)) return modules;

    const files = fs.readdirSync(unitPath).filter(
        (file) => (file.endsWith('.ts') || file.endsWith('.js')) && file !== 'ctl.ts'
    );

    for (const file of files) {
        try {
            const filePath = path.join(unitPath, file);
            const mod = require(filePath);
            modules.push({
                name: mod.name || file.replace(/\.(ts|js)$/, ''),
                description: mod.description || 'No description',
            });
        } catch {
            // skip all failed modules;
        }
    }

    return modules;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error('This command is restricted to bot owners only');
    }

    const ctlPath = path.join(__dirname);
    const botctlPath = path.join(ctlPath, 'botctl');

    const botctlModules = getModulesFromFolder(botctlPath);

    let tree = '```\n';
    tree += 'ctl/\n';

    tree += '└── botctl/\n';
    for (let i = 0; i < botctlModules.length; i++) {
        const mod = botctlModules[i];
        const isLast = i === botctlModules.length - 1;
        const prefix = isLast ? '    └── ' : '    ├── ';
        const paddedName = mod.name.padEnd(10);
        tree += `${prefix}${paddedName} - ${mod.description}\n`;
    }

    tree += '```';

    await message.reply(`**Bot Control Panel**\n${tree}`);
}
