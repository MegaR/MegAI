import { ChatInputCommandInteraction, Client, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import Command from "./command.interface";
import { getLogger } from "../logger";
import { ai } from "../openaiwrapper";

const log = getLogger("InstructCommand");

export const instructCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("instruct")
        .setDescription("Use instruct-GPT")
        .addStringOption((option) =>
            option
                .setName("prompt")
                .setDescription("Prompt")
                .setRequired(true)
        ),
    handleCommand: async (_client: Client, interaction: ChatInputCommandInteraction) => {
        const reply = await interaction.reply({
            embeds: [new EmbedBuilder().setTitle("I'm thinking...⌛")],
        });

        try {
            const prompt = interaction.options.get("prompt", true);
            log.debug(prompt);

            const completion = await ai.instruct(prompt.value as string);
            if (!completion) {
                throw Error("No instruct");
            }
            log.debug(completion);

            const embed = new EmbedBuilder();
            embed.setDescription(completion);
            await reply.edit({
                embeds: [embed],
            });

        } catch (e) {
            log.error(e);
            reply.edit("❌ Something went wrong. 😢");
        }
    },

}
