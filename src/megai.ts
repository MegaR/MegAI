import {
    ChatCompletionRequestMessage,
    ChatCompletionResponseMessage,
} from "openai";
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

const personality: ChatCompletionRequestMessage = {
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
    private readonly log = getLogger("OpenAiWrapper");
    private readonly tools: Tool[] = [
        googleTool,
        googleImagesTool,
        wikipediaTool,
        mathTool,
        stableHordeTool,
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
        username: string,
        prompt: string,
        update: updateCallback
    ): Promise<Session> {
        const message: ChatCompletionRequestMessage = {
            role: "user",
            name: username,
            content: prompt,
        };
        this.history.addMessage(message);
        const memories = await this.recall(prompt);
        await this.remember(prompt);

        const memoriesPrompt: ChatCompletionRequestMessage = {
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
                { functions: this.tools.map((tool) => tool.definition) },
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
        this.history.addMessage(completion);

        if (completion.function_call) {
            const toolResponse = await this.handleFunctionCall(
                completion,
                session,
                update
            );
            this.history.addMessage(toolResponse);
            session.history.push(toolResponse);
            return await this.chatCompletion(session, update);
        }
        this.log.debug(`[${this.botName}] ${completion.content}`);
        session.responses.push(completion.content!);
        update(session);
    }

    private async handleFunctionCall(
        aiMessage: ChatCompletionResponseMessage,
        session: Session,
        update: updateCallback
    ): Promise<ChatCompletionRequestMessage> {
        const tool = this.tools.find(
            (tool) => tool.definition.name === aiMessage.function_call!.name
        );
        if (!tool) {
            this.log.warn(`❌ unknown tool ${aiMessage.function_call!.name}`);
            return {
                role: "function",
                name: aiMessage.function_call!.name,
                content: `Unknown function ${aiMessage.function_call!.name}`,
            };
        }
        const parameters = JSON.parse(aiMessage.function_call!.arguments!);
        session.footer.push(
            `🔧 ${tool.definition.name}: ${JSON.stringify(parameters)}`
        );
        await update(session);
        try {
            const toolOutput = await tool.execute(parameters, session, this);
            this.log.debug(toolOutput);
            await update(session);
            return {
                role: "function",
                name: tool.definition.name,
                content: toolOutput,
            };
        } catch (e: any) {
            this.log.error(e);
            return {
                role: "function",
                name: tool.definition.name,
                content: `Error: ${e.toString()}`,
            };
        }
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
