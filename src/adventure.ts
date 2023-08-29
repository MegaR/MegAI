import { ChatCompletionRequestMessage } from "openai";
import { ai } from "./openaiwrapper";
import { getLogger } from "./logger";

let sessions: AdventureSession[] = [];
const log = getLogger("adventure");

interface AdventureSession {
    threadId: string;
    messages: ChatCompletionRequestMessage[];
    lastOptions: string[];
}

export interface AdventureResult {
    message: string;
    options: string[];
}

function createSystemPrompt(theme: string) {
    return `You are a roleplaying AI. You are the dungeon master. The theme is ${theme}. Keep it interesting.`;
}

export async function startAdventure(
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
    threadId: string,
    optionIndex: number
): Promise<AdventureResult | void> {
    const session = sessions.find((s) => s.threadId === threadId);
    if (!session) return;

    const option = session.lastOptions[optionIndex];
    const message: ChatCompletionRequestMessage = {
        role: "user",
        content: option,
    };
    session.messages.push(message);

    const completion = await ai.chatCompletion(session.messages);
    if (!completion || !completion.content) throw new Error("No completion");

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
