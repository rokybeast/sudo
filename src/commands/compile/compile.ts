import { Message, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const name = 'compile';
export const description = 'Compile and run code using an online compiler';
export const aliases = ['run', 'exec'];

const LANGUAGE_ALIASES: Record<string, string> = {
    'py': 'python',
    'python3': 'python',
    'js': 'javascript',
    'node': 'javascript',
    'ts': 'typescript',
    'cpp': 'c++',
    'c#': 'csharp',
    'cs': 'csharp',
    'rs': 'rust',
    'rb': 'ruby',
    'sh': 'bash',
    'shell': 'bash',
    'pl': 'perl',
    'hs': 'haskell',
    'kt': 'kotlin',
    'swift': 'swift',
    'go': 'go',
    'java': 'java',
    'lua': 'lua',
    'php': 'php',
    'r': 'r',
};

interface PistonRuntime {
    language: string;
    version: string;
    aliases: string[];
}

interface PistonExecuteResponse {
    run: {
        stdout: string;
        stderr: string;
        code: number;
        signal: string | null;
        output: string;
    };
    compile?: {
        stdout: string;
        stderr: string;
        code: number;
        signal: string | null;
        output: string;
    };
}

let runtimesCache: PistonRuntime[] | null = null;

async function getRuntimes(): Promise<PistonRuntime[]> {
    if (runtimesCache) return runtimesCache;

    const response = await fetch('https://emkc.org/api/v2/piston/runtimes');
    if (!response.ok) throw new Error('Failed to fetch runtimes');

    runtimesCache = await response.json() as PistonRuntime[];
    return runtimesCache;
}

function normalizeLanguage(lang: string): string {
    const lower = lang.toLowerCase().trim();
    return LANGUAGE_ALIASES[lower] || lower;
}

async function findRuntime(language: string): Promise<PistonRuntime | null> {
    const runtimes = await getRuntimes();
    const normalized = normalizeLanguage(language);

    let runtime = runtimes.find(r => r.language === normalized);
    if (runtime) return runtime;

    runtime = runtimes.find(r => r.aliases.includes(normalized));
    if (runtime) return runtime;

    return null;
}

async function executeCode(language: string, version: string, code: string): Promise<PistonExecuteResponse> {
    const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            language,
            version,
            files: [{ content: code }],
        }),
    });

    if (!response.ok) {
        throw new Error(`Execution failed: ${response.statusText}`);
    }

    return await response.json() as PistonExecuteResponse;
}

export async function execute(message: Message, args: string[]): Promise<void> {
    const content = message.content;

    if (args.length === 0) {
        throw new Error('Usage: ::compile <language>\\n\\`\\`\\`\\ncode\\n\\`\\`\\`');
    }

    const language = args[0];

    const codeBlockMatch = content.match(/```(?:\w*\n)?([\s\S]*?)```/);

    if (!codeBlockMatch) {
        throw new Error('No code block found. Please wrap your code in \\`\\`\\`');
    }

    const code = codeBlockMatch[1].trim();

    if (!code) {
        throw new Error('Code block is empty');
    }

    await compileAndSend(message, language, code);
}



async function compileAndSend(message: Message, language: string, code: string) {
    try {
        const runtime = await findRuntime(language);

        if (!runtime) {
            const embed = new EmbedBuilder()
                .setTitle('Compilation Error')
                .setDescription(`Unsupported language: \`${language}\``)
                .setColor(0xff0000);

            await message.reply({ embeds: [embed] });
            return;
        }

        const result = await executeCode(runtime.language, runtime.version, code);

        if (result.compile && result.compile.code !== 0) {
            const errorOutput = result.compile.stderr || result.compile.output || 'Compilation failed';
            const embed = new EmbedBuilder()
                .setTitle('Compilation Error')
                .setDescription(`\`\`\`\n${truncateOutput(errorOutput)}\n\`\`\``)
                .setColor(0xff0000)
                .setFooter({ text: `${runtime.language} ${runtime.version}` });

            await message.reply({ embeds: [embed] });
            return;
        }

        const hasError = result.run.code !== 0 || result.run.stderr;
        const output = result.run.output || result.run.stdout || result.run.stderr || 'No output';

        const embed = new EmbedBuilder()
            .setTitle(hasError ? 'Runtime Error' : 'Output')
            .setDescription(`\`\`\`\n${truncateOutput(output)}\n\`\`\``)
            .setColor(hasError ? 0xff0000 : 0x000000)
            .setFooter({ text: `${runtime.language} ${runtime.version} | Exit code: ${result.run.code}` });

        await message.reply({ embeds: [embed] });

    } catch (error) {
        console.error('Compile error:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

        const embed = new EmbedBuilder()
            .setTitle('Error')
            .setDescription(`\`\`\`\n${errorMessage}\n\`\`\``)
            .setColor(0xff0000);

        await message.reply({ embeds: [embed] });
    }
}

function truncateOutput(output: string, maxLength: number = 1900): string {
    if (output.length <= maxLength) return output;
    return output.substring(0, maxLength - 20) + '\n...(truncated)';
}
