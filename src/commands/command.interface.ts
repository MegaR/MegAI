import { Client, SlashCommandBuilder, CommandInteraction } from "discord.js";

export default interface Command<T extends CommandInteraction> {
    definition: SlashCommandBuilder | any;
    handleCommand: (client: Client, interaction: T) => Promise<void>;
}
