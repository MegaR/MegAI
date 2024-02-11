import {
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import Command from "./command.interface";
import { ai } from "../openaiwrapper";
import { getLogger } from "../logger";

const log = getLogger("summaryCommand");

export const summaryCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("summary")
        .setDescription("Summarize the chat history"),

    handleCommand: async (
        _client: Client,
        interaction: ChatInputCommandInteraction
    ) => {
        log.info(`Summary requested by ${interaction.user.username}`);

        interaction.deferReply({ ephemeral: true });
        const messages = await interaction.channel?.messages.fetch({
            limit: 100,
        });
        if (messages === undefined) {
            await interaction.editReply("No messages found");
            return;
        }

        const question =
            `Please give a detailed summary the following chat history. Use bulletpoints.\n` +
            messages
                .filter((message) => !message.author.bot)
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
                .map(
                    (message) =>
                        `${message.author.username}: ${message.cleanContent}`
                )
                .join("\n");

        const summary = await ai.chatCompletion(
            [{ role: "user", content: question }],
            { model: "gpt-3.5-turbo-16k" }
        );
        if (summary === undefined) {
            await interaction.editReply("❌ Summary failed");
            return;
        }

        await interaction.editReply({
            embeds: [new EmbedBuilder().setDescription(summary.content!)],
        });
    },
};
