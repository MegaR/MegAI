import Tool from "./tool.interface";
import googleTool from "./tools/google.tool";
import wikipediaTool from "./tools/wikipedia.tool";
import HistoryManager from "./historymanager";
import mathTool from "./tools/math.tool";
import stableHordeTool from "./tools/stablehorde.tool";
import { Session } from "./session.interface";
import googleImagesTool from "./tools/google-images.tool";
import * as vectorDB from "./vectordb";
import { getLogger } from "./logger";
import { ai } from "./openaiwrapper";
import { ChatCompletionAssistantMessageParam, ChatCompletionSystemMessageParam, ChatCompletionToolMessageParam, ChatCompletionUserMessageParam } from "openai/resources/chat/completions";
import dalleTool from "./tools/dalle.tool";
import browserTool from "./tools/browser.tool";

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
        wikipediaTool,
        mathTool,
        // stableHordeTool,
        dalleTool,
        browserTool,
        // sayTool,
        // weatherTool,
        // rememberTool,
        // searchMemoriesTool,
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
        prompt: string,
        images: Blob[],
        update: updateCallback
    ): Promise<Session> {
        const message: ChatCompletionUserMessageParam = {
            role: "user",
            content: prompt,
        };
        this.history.addMessage(message);
        const memories = await this.recall(prompt);
        await this.remember(prompt);

        const memoriesPrompt: ChatCompletionSystemMessageParam = {
            role: "system",
            content: `Memories:\n${memories.map((m) => m.content).join("\n")}`,
        };
        const history = [
            personality,
            memoriesPrompt,
            ...this.history.getHistory(),
        ];
        const session: Session = {
            history,
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
        let completion;
        try {
            completion = await ai.chatCompletion(
                session.history,
                {
                    tools: this.tools.map((tool) => ({ type: 'function', function: tool.definition }))
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
                this.log.debug('tool call: ', toolCall.function.name);
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

    public async remember(content: string) {
        const response = await ai.embedding(content);
        if (!response) throw new Error("No response");
        const embedding = response[0].embedding;
        await vectorDB.saveMemory(content, embedding);
    }

    public async recall(query: string) {
        const response = await ai.embedding(query);
        if (!response) throw new Error("No response");
        const embedding = response[0].embedding;
        return await vectorDB.getNearestMemories(embedding, 10);
    }
}
