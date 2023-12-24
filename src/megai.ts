import Tool from "./tool.interface";
import googleTool from "./tools/google.tool";
import wikipediaTool from "./tools/wikipedia.tool";
import HistoryManager from "./historymanager";
import mathTool from "./tools/math.tool";
import { Session } from "./session.interface";
import googleImagesTool from "./tools/google-images.tool";
import { getLogger } from "./logger";
import { ai } from "./openaiwrapper";
import { ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam, ChatCompletionToolMessageParam, ChatCompletionUserMessageParam } from "openai/resources/chat/completions";
import dalleTool from "./tools/dalle.tool";
import browserTool from "./tools/browser.tool";
import googlePlacesTool from "./tools/google-places.tool";

const personality: ChatCompletionSystemMessageParam = {
    role: "system",
    content: [
        "AI, you are playing the role of a Discord bot named BOTNAME. You were created by a user named Rachel, also known as Mega_R.",
        "Your catchphrase is 'BABA-GABOOSH!'",
        "In your responses, make use of markdown formatting and some emojis.",
        "NEVER say things twice.",
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
        mathTool,
        // stableHordeTool,
        dalleTool,
        browserTool,
        // sayTool,
        // weatherTool,
        // elevenLabsTool,
    ];
    private readonly history = new HistoryManager();

    constructor(private readonly botName: string) {
        personality.content = personality.content!.replace(
            "BOTNAME",
            this.botName
        );
    }

    async reply(
        userId: string,
        prompt: string,
        images: Blob[],
        update: updateCallback
    ): Promise<Session> {
        const message: ChatCompletionUserMessageParam = {
            role: "user",
            content: prompt,
        };
        this.history.addMessage(message);

        const history = [
            personality,
            ...this.history.getHistory(),
        ];
        const session: Session = {
            history,
            userId,
            responses: [],
            attachments: [],
            footer: [],
        };
        await this.chatCompletion(session, update);
        return session;
    }

    private async chatCompletion(
        session: Session,
        update: updateCallback
    ): Promise<void> {
        let tools = this.tools;
        if (session.userId !== process.env.ADMIN) {
            tools = this.tools.filter(tool => tool.adminOnly === undefined);
        }

        let completion;
        try {
            completion = await ai.chatCompletion(
                session.history,
                {
                    tools: tools.map((tool) => ({ type: 'function', function: tool.definition }))
                },
            );
        } catch (e: any) {
            if (e?.response?.data?.error?.type === "server_error") {
                this.log.warn("Server error. Retrying...");
                return await this.chatCompletion(session, update);
            }
            throw e;
        }
        if (!completion) throw new Error("No completion");

        session.history.push(completion);

        if (completion.tool_calls) {
            const toolResponses = await this.handleToolCall(
                completion,
                session,
                update
            );

            session.history = session.history.concat(toolResponses);
            return await this.chatCompletion(session, update);
        }
        this.history.addMessage(completion);
        this.log.debug(`[${this.botName}] ${completion.content}`);
        session.responses.push(completion.content!);
        update(session);
    }

    private async handleToolCall(
        aiMessage: ChatCompletionAssistantMessageParam,
        session: Session,
        update: updateCallback
    ): Promise<ChatCompletionToolMessageParam[]> {
        const responses: ChatCompletionToolMessageParam[] = [];

        for (const toolCall of aiMessage.tool_calls!) {
            try {
                this.log.debug('tool call:', toolCall.function.name);
                const tool = this.tools.find(
                    (tool) => tool.definition.name === toolCall.function.name
                );
                if (!tool) {
                    this.log.warn(`❌ unknown tool ${toolCall.function.name}`);
                    responses.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: `Unknown function ${toolCall.function.name}`,
                    });
                    continue;
                }
                const parameters = JSON.parse(toolCall.function.arguments);
                session.footer.push(
                    `🔧 ${toolCall.function.name}: ${JSON.stringify(parameters)}`
                );
                await update(session);
                const toolOutput = await tool.execute(parameters, session, this);
                this.log.debug('Tool output: ', toolOutput);
                await update(session);
                responses.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolOutput,
                });
            } catch (e: any) {
                this.log.error(e);
                responses.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: `Error: ${e.toString()}`,
                });
            }

        }
        return responses;
    }
}
