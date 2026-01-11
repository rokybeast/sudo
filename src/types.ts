import { Message, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from 'discord.js';

export interface Command {
    name: string;
    description: string;
    execute: (message: Message, args: string[]) => Promise<void>;
}

export interface SlashCommand {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    executeSlash: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
