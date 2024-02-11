import {
    ChatInputCommandInteraction,
    Client,
    ColorResolvable,
    EmbedBuilder,
    SlashCommandBuilder,
    ThreadChannel,
} from "discord.js";
import Command from "./command.interface";
import { getLogger } from "../logger";
import { ai } from "../openaiwrapper";
import Tool from "../tool.interface";
import googleTool from "../tools/google.tool";
import googleImagesTool from "../tools/google-images.tool";
import googlePlacesTool from "../tools/google-places.tool";
import wikipediaTool from "../tools/wikipedia.tool";
import browserTool from "../tools/browser.tool";
import { AssistantUpdateParams } from "openai/resources/beta/assistants/assistants";
import {
    MessageContentText,
    MessageCreateParams,
    ThreadMessage,
} from "openai/resources/beta/threads/messages/messages";
import { sleep } from "openai/core";
import {
    RequiredActionFunctionToolCall,
    RunSubmitToolOutputsParams,
} from "openai/resources/beta/threads/runs/runs";
import dalleTool from "../tools/dalle.tool";
import inspectImageTool from "../tools/inspect-image.tool";

const tools: Tool[] = [
    googleTool,
    googleImagesTool,
    googlePlacesTool,
    wikipediaTool,
    dalleTool,
    browserTool,
    inspectImageTool,
];

const log = getLogger("Task");
export const taskCommand: Command<ChatInputCommandInteraction> = {
    definition: new SlashCommandBuilder()
        .setName("task")
        .setDescription("Start a task with criteria.")
        .addStringOption((option) =>
            option
                .setName("task")
                .setDescription("What the AI should do")
                .setRequired(true)
        )
        .addStringOption((option) =>
            option
                .setName("criteria")
                .setDescription("Criteria for the task")
                .setRequired(true)
        )
        .setDMPermission(false),
    handleCommand: async (
        _client: Client,
        interaction: ChatInputCommandInteraction
    ) => {
        const task = interaction.options.getString("task", true);
        const criteria = interaction.options.getString("criteria", true);
        const reply = await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle(`Task: ${task}`)
                    .setDescription(`*Criteria:* ${criteria}`),
            ],
        });
        const threadChannel = await (
            await reply.fetch()
        ).startThread({ name: `task: ${task}` });
        try {
            await startTask(task, criteria, threadChannel);
        } catch (e) {
            log.error(e);
            await threadChannel.send("❌ An error has occurred");
        }
    },
};

async function startTask(
    task: string,
    criteria: string,
    thread: ThreadChannel
) {
    log.info(`Starting task: ${task}`);
    await setupAssistants();

    const threadA = await ai.createThread();
    const threadB = await ai.createThread();

    let newMessages: MessageCreateParams[] = [
        { role: "user", content: "Start task" },
    ];
    for (let i = 0; i < 10; i++) {
        let results: ThreadMessage[] | true = await handleAssistantA(
            task,
            threadA,
            newMessages
        );
        await updateThread(thread, results, "Green");

        newMessages = (
            results
                .flatMap((r) => r.content)
                .filter((c) => c.type === "text") as MessageContentText[]
        ).map((c) => ({ role: "user", content: c.text.value }));
        results = await handleAssistantB(criteria, threadB, newMessages);
        if (results === true) {
            thread.send("Task finished 🏁");
            return;
        }
        await updateThread(thread, results, "Yellow");
        newMessages = (
            results
                .flatMap((r) => r.content)
                .filter((c) => c.type === "text") as MessageContentText[]
        ).map((c) => ({ role: "user", content: c.text.value }));
    }
    thread.send("Task failed 😔");
}

async function handleAssistantA(
    task: string,
    threadId: string,
    messages: MessageCreateParams[]
) {
    let lastMessage;
    for (const message of messages) {
        lastMessage = await ai.addMessage(threadId, message);
    }
    // const run = await ai.assistantCompletion(threadId, `You are a task doing AI. Take a breath and think step-by-step. Your task: '${task}'`, process.env.OPENAI_TASKAI_A);
    const run = await ai.assistantCompletion(
        threadId,
        `You are a task doing AI. Do the task and always apply all feedback. Don't wait for feedback to get started. Take a breath and think step-by-step. Your task: '${task}'`,
        process.env.OPENAI_TASKAI_A
    );
    const status = await handleRun(threadId, run.id);
    if (status !== "completed") {
        throw new Error(`Incorrect status ${status}`);
    }

    return ai.getMessages(threadId, lastMessage?.id);
}

async function handleAssistantB(
    criteria: string,
    threadId: string,
    messages: MessageCreateParams[]
) {
    let lastMessage;
    for (const message of messages) {
        lastMessage = await ai.addMessage(threadId, message);
    }
    const run = await ai.assistantCompletion(
        threadId,
        `You're a feedback AI. Keep criticizing the user until ALL of the following criteria are met: '${criteria}'. Only respond with detailed feedback. Be very strict! Keep the user on task and responding with progress.`,
        process.env.OPENAI_TASKAI_B
    );
    const status = await handleRun(threadId, run.id);
    if (status === true) {
        return true;
    }
    if (status !== "completed") {
        throw new Error(`Incorrect status ${status}`);
    }

    return ai.getMessages(threadId, lastMessage?.id);
}

async function updateThread(
    thread: ThreadChannel,
    messages: ThreadMessage[],
    color: ColorResolvable
) {
    for (const message of messages) {
        for (const content of message.content) {
            if (content.type === "image_file") {
                continue;
            }
            log.debug(content.text.value);
            if (!content.text.value || content.text.value.length === 0)
                continue;
            await thread.send({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(content.text.value)
                        .setColor(color),
                ],
            });
        }
    }
}

async function handleRun(
    threadId: string,
    runId: string
): Promise<
    | "queued"
    | "in_progress"
    | "requires_action"
    | "cancelling"
    | "cancelled"
    | "failed"
    | "completed"
    | "expired"
    | true
> {
    let status;
    do {
        await sleep(1000);
        status = await ai.getRun(threadId, runId);

        //handle tool calls
        if (
            status.status === "requires_action" &&
            status.required_action?.type === "submit_tool_outputs"
        ) {
            const toolCalls =
                status.required_action.submit_tool_outputs.tool_calls;
            if (toolCalls.find((c) => c.function.name === "finished")) {
                log.info("task finished");
                return true;
            }
            const toolOutputs: RunSubmitToolOutputsParams.ToolOutput[] = [];
            for (const call of toolCalls) {
                const retVal = await handleToolCall(call);
                if (retVal.rating === 10) {
                    return true;
                }
                toolOutputs.push(retVal.output);
            }
            log.debug("tool finished. Submitting results");
            await ai.submitToolOutputs(threadId, runId, toolOutputs);
            return await handleRun(threadId, runId);
        }
    } while (status.status === "in_progress");

    return status.status;
}

async function handleToolCall(
    call: RequiredActionFunctionToolCall
): Promise<{ rating?: number; output: RunSubmitToolOutputsParams.ToolOutput }> {
    if (call.function.name === "rate") {
        console.log(call.function.arguments);
        const rating = JSON.parse(call.function.arguments)?.rating;
        log.debug(`The ai gave the following rating: ${rating}`);
        return {
            rating: rating,
            output: { tool_call_id: call.id, output: "Rating stored." },
        };
    }
    const tool = tools.find((t) => t.definition.name === call.function.name);
    // Tool not found
    if (!tool) {
        log.warn(`❌ Tool ${call.function.name} not found`);
        return {
            output: {
                tool_call_id: call.id,
                output: `Tool ${call.function.name} not found!`,
            },
        };
    }

    // Execute the tool
    try {
        log.debug(
            `Executing tool ${tool.definition.name} with parameters ${call.function.arguments}`
        );
        const toolOutput = await tool.execute(
            JSON.parse(call.function.arguments)
        );
        return {
            output: {
                tool_call_id: call.id,
                output: toolOutput,
            },
        };
    } catch (error) {
        log.warn(`[${call.function.name}] ${error}`);
        return {
            output: {
                tool_call_id: call.id,
                output: `Error: ${error}`,
            },
        };
    }
}

async function setupAssistants() {
    const definitions: Array<
        | AssistantUpdateParams.AssistantToolsCode
        | AssistantUpdateParams.AssistantToolsRetrieval
        | AssistantUpdateParams.AssistantToolsFunction
    > = tools.map((t) => ({ type: "function", function: t.definition }));
    // definitions.push({ type: 'code_interpreter' });
    ai.updateAssistant(
        {
            tools: definitions,
        },
        process.env.OPENAI_TASKAI_A
    );

    ai.updateAssistant(
        {
            tools: [
                // {
                //     type: 'function',
                //     function: {
                //         name: 'finished',
                //         description: 'Use this function only if ALL criteria are met',
                //         parameters: {
                //             type: "object",
                //             properties: {},
                //             required: [],
                //         }
                //     }
                // },
                {
                    type: "function",
                    function: {
                        name: "rate",
                        description: "Rating of the user's work from 1 to 10",
                        parameters: {
                            type: "object",
                            properties: {
                                rating: {
                                    type: "number",
                                    description: "Rating from 1 to 10.",
                                },
                            },
                            required: ["rating"],
                        },
                    },
                },
            ],
        },
        process.env.OPENAI_TASKAI_B
    );
}
