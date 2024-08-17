import {
    AttachmentBuilder,
    ChatInputCommandInteraction,
    Client,
    EmbedBuilder,
    SlashCommandBuilder,
} from "discord.js";
import Command from "./command.interface";
import { getLogger } from "../logger";
import { ai } from "../openaiwrapper";

const log = getLogger("dalleCommand");

export const dalleCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("imagine")
        .setDescription("Use Dall-e3 to generate an image.")
        .addStringOption((option) =>
            option.setName("prompt").setDescription("Prompt").setRequired(true)
        ),
    handleCommand: async (
        _client: Client,
        interaction: ChatInputCommandInteraction
    ) => {
        if (interaction.user.id !== process.env.ADMIN) {
            await interaction.reply(
                "❌ You are not authorized to use this command. Try `/imagine`"
            );
            return;
        }
        const reply = await interaction.reply("🎨 painting...");

        try {
            const prompt = interaction.options.get("prompt", true);
            log.debug(prompt);

            const image = await ai.dalle(prompt.value as string);
            const data = Buffer.from(image.b64_json!, "base64");

            const embed = new EmbedBuilder()
                .addFields([
                    { name: "prompt", value: prompt.value as string },
                    {
                        name: "revised prompt",
                        value: image.revised_prompt || (prompt.value as string),
                    },
                ])
                .setImage("attachment://image.png");

            await reply.edit({
                content: '',
                embeds: [embed],
                files: [
                    new AttachmentBuilder(data, {
                        name: "image.png",
                    }),
                ],
            });
        } catch (e: any) {
            if(e?.code === "content_policy_violation") {
                reply.edit("⛔ content policy violation");
                return;
            }
            log.error(e);
            reply.edit("❌ Something went wrong. 😢");
        }
    },
};
