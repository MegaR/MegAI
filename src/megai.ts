import Tool from "./tool.interface";
import googleTool from "./tools/google.tool";
import wikipediaTool from "./tools/wikipedia.tool";
import mathTool from "./tools/math.tool";
import { Session } from "./session.interface";
import googleImagesTool from "./tools/google-images.tool";
import { getLogger } from "./logger";
import { ai } from "./openaiwrapper";
import { ChatCompletionSystemMessageParam } from "openai/resources/chat/completions";
import dalleTool from "./tools/dalle.tool";
import browserTool from "./tools/browser.tool";
import googlePlacesTool from "./tools/google-places.tool";
import { MessageCreateParams } from "openai/resources/beta/threads/messages/messages";
import { sleep } from "openai/core";
import { AssistantUpdateParams } from "openai/resources/beta/assistants/assistants";
import Lock from "./lock";
import { RequiredActionFunctionToolCall, RunSubmitToolOutputsParams } from "openai/resources/beta/threads/runs/runs";
import inspectImageTool from "./tools/inspect-image.tool";

const personality: ChatCompletionSystemMessageParam = {
    role: "system",
    content: [
        "AI, you are playing the role of a Discord bot named BOTNAME. You were created by a user named Rachel, also known as Mega_R.",
        "Your catchphrase is 'BABA-GABOOSH!'",
        "In your responses, make use of markdown formatting and some emojis.",
        "Take a breath and think step-by-step.",
    ].join(" "),
};

type UpdateCallback = (session: Session) => Promise<void>;

type Thread = {
    threadId: string;
    lock: Lock;
}

export class MegAI {
    private readonly log = getLogger("MegAI");
    private readonly tools: Tool[] = [
        googleTool,
        googleImagesTool,
        googlePlacesTool,
        wikipediaTool,
        // mathTool,
        // stableHordeTool,
        dalleTool,
        browserTool,
        // sayTool,
        // weatherTool,
        // elevenLabsTool,
        inspectImageTool,
    ];
    private threadMap = new Map<string, Thread>();

    constructor(private readonly botName: string) {
        personality.content = personality.content!.replace(
            "BOTNAME",
            this.botName
        );
        const definitions: Array<
            | AssistantUpdateParams.AssistantToolsCode
            | AssistantUpdateParams.AssistantToolsRetrieval
            | AssistantUpdateParams.AssistantToolsFunction
        > = this.tools.map(t => ({ type: 'function', function: t.definition }));
        definitions.push({ type: 'code_interpreter' });
        ai.updateAssistant({
            tools: definitions,
        });
    }

    async reply(
        channelId: string,
        userId: string,
        prompt: string,
        attachments: {name: string, data: ArrayBuffer}[],
        update: UpdateCallback
    ): Promise<Session> {
        const files: string[] = [];
        // try {
            for (const attachment of attachments) {
                const fileId = await ai.createFile(attachment.data, attachment.name);
                files.push(fileId);
            }

            const message: MessageCreateParams = {
                role: "user",
                content: prompt,
                file_ids: files,
            };

            const session: Session = {
                channelId,
                userId,
                responses: [],
                attachments: [],
                footer: [],
            };
            await this.chatCompletion(session, update, message);
            return session;
        // } finally {
        //     for (const file of files) {
        //         await ai.deleteFile(file);
        //     }
        // }
    }

    public clearThread(channelId: string) {
        this.threadMap.delete(channelId);
    }

    private async chatCompletion(
        session: Session,
        update: UpdateCallback,
        message: MessageCreateParams,
    ): Promise<void> {
        const thread = await this.getThread(session.channelId);
        await thread.lock.acquire();
        try {
            let threadId = thread.threadId;
            const messageId = (await ai.addMessage(threadId, message)).id;
            const run = await ai.assistantCompletion(threadId, personality.content);
            let status;
            try {
                status = await this.handleRun(threadId, run.id, session, update);
            } catch (error) {
                ai.cancelRun(threadId, run.id);
                throw error;
            }
            if (status !== 'completed') {
                throw new Error(`Status ${status}`);
            }
            await this.handleCodeInterpreter(threadId, run.id, session);
            const messages = await ai.getMessages(threadId, messageId);
            for (const result of messages) {
                for (const content of result.content) {
                    if (content.type === 'text') {
                        session.responses.push(content.text.value);
                        this.log.debug(`[${this.botName}] ${content.text.value}`)
                    } else {
                        const file = await ai.retrieveFile(content.image_file.file_id);
                        const data = Buffer.from(file);
                        session.attachments.push({ name: 'image.png', file: data })
                    }
                }
            }
            update(session);
        } finally {
            thread.lock.release();
        }
    }

    private async handleRun(threadId: string, runId: string, session: Session, update: UpdateCallback): Promise<
        'queued'
        | 'in_progress'
        | 'requires_action'
        | 'cancelling'
        | 'cancelled'
        | 'failed'
        | 'completed'
        | 'expired'> {
        let status;
        do {
            await sleep(1000);
            status = await ai.getRun(threadId, runId);

            //handle tool calls
            if (status.status === 'requires_action' && status.required_action?.type === 'submit_tool_outputs') {
                const toolCalls = status.required_action.submit_tool_outputs.tool_calls;
                const toolOutputs: RunSubmitToolOutputsParams.ToolOutput[] = [];
                for (const call of toolCalls) {
                    toolOutputs.push(await this.handleToolCall(call, session, update));
                }
                await ai.submitToolOutputs(threadId, runId, toolOutputs);
                return await this.handleRun(threadId, runId, session, update);
            }

        } while (status.status === "in_progress");

        return status.status;
    }

    async handleToolCall(call: RequiredActionFunctionToolCall, session: Session, update: UpdateCallback): Promise<RunSubmitToolOutputsParams.ToolOutput> {
        const tool = this.findTool(call.function.name);
        // Tool not found
        if (!tool) {
            this.log.warn(`❌ Tool ${call.function.name} not found`);
            throw new Error(`Unknown tool ${call.function.name}`);
        }

        // Admin only tool
        if (tool.adminOnly && session.userId !== process.env.ADMIN) {
            this.log.warn(`tool ${tool.definition.name} is admin only`);
            return {
                tool_call_id: call.id,
                output: 'This function call is not allowed for this user',
            };
        }

        // Add tool call to footer
        this.log.debug('tool call:', call.function.name);
        session.footer.push(
            `🔧 ${call.function.name}: ${JSON.stringify(call.function.arguments)}`
        );
        await update(session);

        // Execute the tool
        try {
            const toolOutput = await tool.execute(JSON.parse(call.function.arguments), session, this);
            this.log.debug('tool output: ', toolOutput);
            await update(session);
            return {
                tool_call_id: call.id,
                output: toolOutput,
            };
        } catch (error) {
            this.log.warn(`[${call.function.name}] ${error}`);
            return {
                tool_call_id: call.id,
                output: `Error: ${error}`,
            };
        }
    }

    private async handleCodeInterpreter(threadId: string, runId: string, session: Session) {
        const steps = await ai.getRunSteps(threadId, runId);
        for (const step of steps) {
            if (step.step_details.type !== 'tool_calls') {
                continue;
            }

            for (const call of step.step_details.tool_calls) {
                if (call.type !== 'code_interpreter') {
                    continue;
                }
                session.attachments.push({ name: 'code.txt', file: Buffer.from(call.code_interpreter.input) });
                // session.attachments.push({ name: 'code_output.txt', file: Buffer.from(JSON.stringify(call.code_interpreter.outputs, null, 2)) });
            }
        }
    }

    private findTool(toolId: string): Tool | undefined {
        return this.tools.find(tool => tool.definition.name === toolId);
    }

    private async getThread(key: string): Promise<Thread> {
        let thread = this.threadMap.get(key);
        if (thread === undefined) {
            thread = { threadId: await ai.createThread(), lock: new Lock() };
            this.threadMap.set(key, thread);
        }
        return thread;
    }
}
