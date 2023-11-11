import { AttachmentBuilder, ChatInputCommandInteraction, Client, SlashCommandBuilder } from "discord.js";
import Command from "./command.interface";
import { getLogger } from "../logger";
import { ai } from "../openaiwrapper";

const log = getLogger("dalleCommand");

export const dalleCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("image")
        .setDescription("Use Dall-e3 to generate an image.")
        .addStringOption((option) =>
            option
                .setName("prompt")
                .setDescription("Prompt")
                .setRequired(true)
        ),
    handleCommand: async (_client: Client, interaction: ChatInputCommandInteraction) => {
        if(interaction.user.id !== process.env.ADMIN) {
            await interaction.reply("❌ You are not authorized to use this command.");
            return;
        }
        const reply = await interaction.reply("🎨 painting...");

        try {
            const prompt = interaction.options.get("prompt", true);
            log.debug(prompt);

            const image = await ai.dalle(prompt.value as string);
            const data = Buffer.from(image, "base64");
            await reply.edit({
                content: prompt.value as string,
                files: [
                    new AttachmentBuilder(data, {
                        name: 'image.png'
                    })
                ],
            });

        } catch (e) {
            log.error(e);
            reply.edit("❌ Something went wrong. 😢");
        }
    },

}
