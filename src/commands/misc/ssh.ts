import {
    Message,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ModalActionRowComponentBuilder,
    ComponentType,
} from "discord.js";
import { isOwner } from "../../utils/permissions";
import { createEmbed } from "../../utils/embed";
import { execFileSync } from "child_process";
import path from "path";

export const name = "ssh";
export const description = "Execute a shell command on the host machine";

let sessionCwd = process.cwd();

export async function execute(message: Message, args: string[]): Promise<void> {
    if (!isOwner(message.author.id)) {
        throw new Error("This command is restricted to bot owners only");
    }

    if (args.length === 0) {
        throw new Error("No command provided");
    }

    const commandStr = args.join(" ");

    const authButton = new ButtonBuilder()
        .setCustomId(`ssh_auth_${message.id}`)
        .setLabel("Authenticate")
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder<any>().addComponents(authButton);

    const prompt = await message.reply({
        content: "[info]: SSH session requires authentication.",
        components: [row],
    });

    const buttonCollector = prompt.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (i) => i.user.id === message.author.id && i.customId === `ssh_auth_${message.id}`,
        max: 1,
        time: 30_000,
    });

    buttonCollector.on("collect", async (buttonInteraction) => {
        const modal = new ModalBuilder()
            .setCustomId(`ssh_modal_${message.id}`)
            .setTitle("SSH Authentication");

        const secretInput = new TextInputBuilder()
            .setCustomId("termsec_input")
            .setLabel("Enter terminal secret")
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const modalRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(secretInput);
        modal.addComponents(modalRow);

        await buttonInteraction.showModal(modal);

        try {
            const modalSubmit = await buttonInteraction.awaitModalSubmit({
                filter: (i) => i.customId === `ssh_modal_${message.id}`,
                time: 30_000,
            });

            const secret = modalSubmit.fields.getTextInputValue("termsec_input");

            if (secret !== process.env.TERMSEC) {
                await modalSubmit.reply({ content: "[error]: Incorrect secret. SSH session denied.", ephemeral: true });
                await prompt.edit({ content: "[error]: Authentication failed.", components: [] });
                return;
            }

            await modalSubmit.deferUpdate();
            await prompt.edit({ content: "[OK]: Authenticated. Executing command...", components: [] });

            const execPath = path.resolve(__dirname, "..", "..", "lib", "exec");

            if (commandStr.startsWith("cd ")) {
                const targetDir = commandStr.slice(3).trim();
                const newPath = path.resolve(sessionCwd, targetDir);
                sessionCwd = newPath;

                const embed = createEmbed()
                    .setTitle("ssh")
                    .setDescription(`\`\`\`\nChanged directory to: ${sessionCwd}\n\`\`\``);

                await prompt.edit({ content: null, embeds: [embed], components: [] });
                return;
            }

            try {
                const output = execFileSync(execPath, [sessionCwd, ...commandStr.split(" ")], {
                    encoding: "utf-8",
                    timeout: 15_000,
                    maxBuffer: 1024 * 1024,
                });

                const trimmed = output.length > 4000 ? output.slice(-4000) : output;

                const embed = createEmbed()
                    .setTitle("ssh")
                    .setDescription(`\`\`\`\n${trimmed || "(no output)"}\n\`\`\``);

                await prompt.edit({ content: null, embeds: [embed], components: [] });
            } catch (err: any) {
                const exitCode = err.status ?? 1;
                const stderr = err.stdout || err.stderr || err.message || "Unknown error";
                const trimmed = stderr.length > 4000 ? stderr.slice(-4000) : stderr;

                const embed = createEmbed()
                    .setColor(0xff0000)
                    .setTitle("ssh")
                    .setDescription(`\`\`\`\n${trimmed}\n\`\`\``)
                    .setFooter({ text: `exit code: ${exitCode}` });

                await prompt.edit({ content: null, embeds: [embed], components: [] });
            }
        } catch {
            await prompt.edit({ content: "[error]: Modal authentication timed out.", components: [] });
        }
    });

    buttonCollector.on("end", async (collected) => {
        if (collected.size === 0) {
            try {
                await prompt.edit({ content: "[error]: SSH session timed out.", components: [] });
            } catch {}
        }
    });
}
