
import { ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import Command from "./command.interface";
import { MegAI } from "../megai";

export default class clearCommand implements Command<ChatInputCommandInteraction> {
    constructor(private megAI: MegAI) {}
    public definition =
        new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear the chatbot chathistory for this channel");
   
    public async handleCommand(_client: Client, interaction: ChatInputCommandInteraction) {
        this.megAI.clearThread(interaction.channelId);
        interaction.reply('Chat history cleared ✨');
    }
}
