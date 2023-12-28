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

const personality: ChatCompletionSystemMessageParam = {
    role: "system",
    content: [
        "AI, you are playing the role of a Discord bot named BOTNAME. You were created by a user named Rachel, also known as Mega_R.",
        "Your catchphrase is 'BABA-GABOOSH!'",
        "In your responses, make use of markdown formatting and some emojis.",
    ].join(" "),
};

type updateCallback = (session: Session) => Promise<void>;

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
    ];
    private threadMap = new Map();

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
        images: Blob[],
        update: updateCallback
    ): Promise<Session> {
        const message: MessageCreateParams = {
            role: "user",
            content: prompt,
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
    }

    private async chatCompletion(
        session: Session,
        update: updateCallback,
        message: MessageCreateParams,
    ): Promise<void> {
        let tools = this.tools;
        if (session.userId !== process.env.ADMIN) {
            tools = this.tools.filter(tool => tool.adminOnly === undefined);
        }

        let threadId = this.threadMap.get(session.channelId);
        if (threadId === undefined) {
            threadId = await ai.createThread();
            this.threadMap.set(session.channelId, threadId);
        }
        await ai.addMessage(threadId, message);
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
        const messages = await ai.getMessages(threadId);
        const result = messages[0];
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
        update(session);
    }

    private async handleRun(threadId: string, runId: string, session: Session, update: updateCallback): Promise<
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
            status = await ai.runStatus(threadId, runId);
            if (status.status === 'requires_action' && status.required_action?.type === 'submit_tool_outputs') {
                const toolCalls = status.required_action.submit_tool_outputs.tool_calls;
                const toolOutputs = [];
                for (const call of toolCalls) {
                    const tool = this.findTool(call.function.name);
                    if (!tool) {
                        this.log.warn(`❌ Tool ${call.function.name} not found`);
                        throw new Error(`Unknown tool ${call.function.name}`);
                    }

                    if (tool.adminOnly && session.userId !== process.env.ADMIN) {
                        this.log.warn(`tool ${tool.definition.name} is admin only`);
                        toolOutputs.push({
                            tool_call_id: call.id,
                            output: 'This function call is not allowed for this user',
                        });
                        continue;
                    }

                    this.log.debug('tool call:', call.function.name);
                    session.footer.push(
                        `🔧 ${call.function.name}: ${JSON.stringify(call.function.arguments)}`
                    );
                    await update(session);
                    const toolOutput = await tool.execute(JSON.parse(call.function.arguments), session, this);
                    this.log.debug('tool output: ', toolOutput);
                    await update(session);

                    toolOutputs.push({
                        tool_call_id: call.id,
                        output: toolOutput,
                    })
                }
                await ai.submitToolOutputs(threadId, runId, toolOutputs);
                return await this.handleRun(threadId, runId, session, update);
            }
        } while (status.status === "in_progress");
        return status.status;
    }

    private findTool(toolId: string): Tool | undefined {
        return this.tools.find(tool => tool.definition.name === toolId);
    }
}
