import { ChatCompletionRequestMessage } from "openai";
import { ai } from "../openaiwrapper";
import { getLogger } from "../logger";
import Lock from "../lock";
import Command from "./command.interface";
import { AnyThreadChannel, AttachmentBuilder, ChatInputCommandInteraction, Client, EmbedBuilder, MessageReaction, PartialMessageReaction, SlashCommandBuilder, ThreadAutoArchiveDuration } from "discord.js";
import { tts } from "../tts";
import { pollinations } from "../tools/pollinations.tool";

const adventureEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

let sessions: AdventureSession[] = [];
const log = getLogger("adventure");

interface AdventureSession {
    threadId: string;
    messages: ChatCompletionRequestMessage[];
    lastOptions: string[];
    lock: Lock;
}

export interface AdventureResult {
    message: string;
    options: string[];
}

function createSystemPrompt(theme: string) {
    return `You are a Adventure AI. You describe the adventure and the user say what the main character does. The theme is ${theme}. Keep it interesting.`;
}

async function startAdventure(
    threadId: string,
    theme: string
): Promise<AdventureResult> {
    const systemPrompt: ChatCompletionRequestMessage = {
        role: "system",
        content: createSystemPrompt(theme),
    };
    const completion = await ai.chatCompletion([
        systemPrompt,
        { role: "system", content: "Start with an intro" },
    ]);

    if (!completion || !completion.content) throw new Error("No completion");

    const session: AdventureSession = {
        threadId,
        messages: [systemPrompt, completion],
        lastOptions: [],
        lock: new Lock(),
    };
    sessions.push(session);

    const options = await getOptions(session);
    session.lastOptions = options;

    return {
        message: completion.content,
        options,
    };
}

export async function adventureReaction(
    session: AdventureSession,
    optionIndex: number
): Promise<AdventureResult | void> {
    const option = session.lastOptions[optionIndex];
    const message: ChatCompletionRequestMessage = {
        role: "user",
        content: option,
    };
    session.messages.push(message);

    const completion = await ai.chatCompletion(session.messages);
    if (!completion || !completion.content) throw new Error("No completion");
    session.messages.push(completion);

    const options = await getOptions(session);
    session.lastOptions = options;

    return {
        message: completion.content,
        options,
    };
}

async function getOptions(session: AdventureSession): Promise<string[]> {
    const functionDef = {
        name: "create_options",
        description: "Create options/actions for the player to choose from",
        parameters: {
            type: "object",
            properties: {
                options: {
                    type: "array",
                    description:
                        "Array with 4 options for the player. Option 4 should be something silly.",
                    items: {
                        type: "string",
                    },
                },
            },
            required: ["options"],
        },
    };
    const completion = await ai.chatCompletion(
        session.messages,
        [functionDef],
        {
            name: "create_options",
        }
    );

    if (!completion || !completion.function_call) throw new Error("No options");

    const parameters = JSON.parse(completion.function_call!.arguments!);
    return parameters.options;
}

export async function handleAdventureReactions(reaction: MessageReaction | PartialMessageReaction) {
    if (reaction.partial) {
        await reaction.fetch();
    }
    const channel = reaction.message.channel;
    if (!channel.isThread()) return;
    if (!reaction.emoji.name) return;
    if (!adventureEmojis.includes(reaction.emoji.name)) return;

    const index = adventureEmojis.indexOf(reaction.emoji.name);

    const session = sessions.find((s) => s.threadId === channel.id);
    if (!session) return;
    if (session.lock.isLocked()) return;

    await session.lock.acquire();
    try {
        const result = await adventureReaction(session, index);
        if (!result) return;
        await handleAdventureResult(channel, result);
    } finally {
        session.lock.release();
    }

}

async function handleAdventureResult(
    thread: AnyThreadChannel<boolean>,
    result: AdventureResult
) {
    try {
        const content =
            `${result.message}\n\n` +
            result.options.map((o, i) => `${i + 1}. ${o}`).join("\n");

        const embed = new EmbedBuilder();
        embed.setDescription(content);

        const message = await thread.send({
            embeds: [embed],
        });
        result.options.forEach((_, i) => {
            message.react(adventureEmojis[i]);
        });

        const audio = await tts(content);
        let attachments: AttachmentBuilder[] = [];
        attachments.push(new AttachmentBuilder(audio, { name: "tts.mp3" }));
        await message.edit({ embeds: [embed], files: attachments });

        const image = await pollinations('test');
        attachments.push(new AttachmentBuilder(image, { name: 'image.png' }));
        await message.edit({ embeds: [embed], files: attachments });
    } catch (e) {
        log.error(e);
    }
}

export const startAdventureCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("startadventure")
        .setDescription("Start a adventure session")
        .addStringOption((option) =>
            option
                .setName("theme")
                .setDescription("theme of the adventure")
                .setRequired(true)
        ),
    handleCommand: async (_client: Client, interaction: ChatInputCommandInteraction) => {
        try {
            const theme = interaction.options.get("theme", true);
            const reply = await interaction.reply({
                content: `Starting adventure with theme: ${theme.value}`,
                fetchReply: true,
            });
            const thread = await reply.startThread({
                name: `Adventure: ${theme.value}`,
                autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
            });

            const result = await startAdventure(thread.id, theme.value as string);
            await handleAdventureResult(thread, result);
        } catch (e) {
            log.error(e);
        }
    },
};
