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
    theme: string;
    plan: ChatCompletionRequestMessage;
    messages: { message: ChatCompletionRequestMessage, summary: ChatCompletionRequestMessage }[];
    lastOptions: string[];
    lock: Lock;
}

export interface AdventureResult {
    message: string;
    options: string[];
}

function createSystemPrompt(theme: string): ChatCompletionRequestMessage {
    return { role: 'system', content: `You are a Adventure AI. You describe the adventure and the user say what the main character does. The theme is ${theme}. Keep it interesting. Write out the dialogs. You can use markdown.` };
}

async function startAdventure(
    threadId: string,
    theme: string
): Promise<AdventureResult> {
    const session: AdventureSession = {
        threadId,
        theme,
        plan: { role: 'system', content: 'Current plan: none' },
        messages: [],
        lastOptions: [],
        lock: new Lock(),
    };

    const plan = await updatePlan(session);

    const systemPrompt: ChatCompletionRequestMessage = createSystemPrompt(theme);
    const completion = await ai.chatCompletion([
        systemPrompt,
        plan,
        { role: "system", content: "Start with an intro" },
    ]);

    if (!completion || !completion.content) throw new Error("No completion");

    session.messages.push({ message: completion, summary: completion });
    const options = await getOptions(session);
    session.lastOptions = options;

    sessions.push(session);
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
        [
            createSystemPrompt(session.theme),
            session.messages[0].summary,
            ...session.messages.slice(1).map(m => m.message),
        ],
        {
            functions: [functionDef],
            function_call: {
                name: "create_options",
            }
        },
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
        const option = session.lastOptions[index];
        const optionMessage: ChatCompletionRequestMessage = {
            role: "user",
            content: option,
        };

        const completion = await ai.chatCompletion([
            createSystemPrompt(session.theme),
            session.plan,
            session.messages[0].summary,
            ...session.messages.slice(1).map(m => m.message),
            optionMessage,
        ]);
        if (!completion || !completion.content) throw new Error("No completion");
        const summary = await generateSummary(session, completion);
        session.messages.push({ message: completion, summary });
        session.messages = session.messages.slice(-10);

        session.plan = await updatePlan(session);

        const options = await getOptions(session);
        session.lastOptions = options;

        await handleAdventureResult(channel, { message: completion.content, options: session.lastOptions });
    } catch (e) {
        log.error(e);
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

        const imagePrompt = await generateSceneDescription(result.message);
        const image = await pollinations(imagePrompt);
        attachments.push(new AttachmentBuilder(image, { name: 'image.png' }));
        await message.edit({ embeds: [embed], files: attachments });
    } catch (e) {
        log.error(e);
    }
}

async function generateSceneDescription(story: string) {
    const functionDef = {
        name: "render_image",
        description: "render an image based op the prompt",
        parameters: {
            type: "object",
            properties: {
                prompt: {
                    type: "string",
                    description:
                        "descriptive sentence about the scene. Use keywords seperated by commas. Use around 10 keywords.",
                },
            },
            required: ["prompt"],
        },
    };
    const completion = await ai.chatCompletion(
        [{
            role: "system",
            content: `Render an image to accompany the following text: ${story}`,
        }],
        {
            functions: [functionDef],
            function_call: {
                name: "render_image",
            }
        },
    );

    if (!completion || !completion.function_call) throw new Error("No image prompt");

    const parameters = JSON.parse(completion.function_call!.arguments!);
    return parameters.prompt;
}

async function generateSummary(session: AdventureSession, newMessage: ChatCompletionRequestMessage): Promise<ChatCompletionRequestMessage> {
    const functionDef = {
        name: "submit_summary",
        description: "Save a summary of the entire story so far. Include characters and events ect.",
        parameters: {
            type: "object",
            properties: {
                summary: {
                    type: "string",
                    description:
                        "Summary of the entire story",
                },
            },
            required: ["summary"],
        },
    };
    const completion = await ai.chatCompletion(
        [
            session.messages[0].summary,
            ...session.messages.slice(1).map(m => m.message),
            newMessage
        ],
        {
            functions: [functionDef],
            function_call: {
                name: "submit_summary",
            }
        },
    );

    if (!completion || !completion.function_call) throw new Error("No summary");

    const parameters = JSON.parse(completion.function_call!.arguments!);
    log.debug("summary: ", parameters.summary);
    return { role: "assistant", content: parameters.summary };
}

async function updatePlan(session: AdventureSession): Promise<ChatCompletionRequestMessage> {
    const functionDef = {
        name: "update_plan",
        description: "Update the plan for the story. Plan out expected plot, fail conditions and characters. Don't make the plan too large",
        parameters: {
            type: "object",
            properties: {
                plan: {
                    type: "string",
                    description:
                        "Full updated plan",
                },
            },
            required: ["plan"],
        },
    };

    let messages: ChatCompletionRequestMessage[] = [];
    if (session.messages.length > 0) {
        messages = [
            session.messages[0].summary,
            ...session.messages.slice(1).map(m => m.message),
        ];
    }


    const completion = await ai.chatCompletion(
        [
            createSystemPrompt(session.theme),
            ...messages,
        ],
        {
            functions: [functionDef],
            function_call: {
                name: "update_plan",
            }
        },
    );

    if (!completion || !completion.function_call) throw new Error("No summary");

    const parameters = JSON.parse(completion.function_call!.arguments!);
    log.debug("plan: ", parameters.plan);
    return { role: 'system', content: `Current plan: ${parameters.plan}` };
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
