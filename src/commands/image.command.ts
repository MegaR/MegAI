import { AttachmentBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import Command from "./command.interface";
import { getLogger } from "../logger";
import { ai } from '../openaiwrapper';

const log = getLogger('image');
export const imageCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("image")
        .setDescription("Ask the ai a question about an image")
        .addAttachmentOption(option =>
            option
                .setName('image')
                .setDescription("Image file you want to ask the AI about")
                .setRequired(true)
        )
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
            const attachment = interaction.options.getAttachment('image');
            if (!attachment) throw new Error('Couldn\'t find attachment');
            const prompt = interaction.options.getString('prompt');
            if (!prompt) throw new Error('Couldn\'t find prompt');

            const completion = await ai.chatCompletion(
                [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: attachment.url, detail: 'low' } },
                        ]
                    }
                ],
                {
                    model: 'gpt-4-vision-preview',
                    max_tokens: 250,
                }

            );

            const imageData = await (await fetch(attachment.url)).arrayBuffer();
            await reply.edit({
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`Prompt: ${prompt}`)
                        .setDescription(completion.content)
                        .setImage('attachment://image.png'),
                ],
                files: [
                    new AttachmentBuilder(Buffer.from(imageData), {
                        name: 'image.png'
                    }),
                ]
            });
        } catch (error) {
            log.error(error);
            reply.edit('❌ An error has occured');
        }
    },
}
