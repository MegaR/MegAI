import {
    ChatCompletionRequestMessage,
    ChatCompletionResponseMessage,
    Configuration,
    OpenAIApi,
} from "openai";
import Tool from "./tool.interface";
import googleTool from "./tools/google.tool";
import wikipediaTool from "./tools/wikipedia.tool";
import HistoryManager from "./historymanager";
import mathTool from "./tools/math.tool";
import stableHordeTool from "./tools/stablehorde.tool";
import { Session } from "./session.interface";
import googleImagesTool from "./tools/google-images.tool";
import weatherTool from "./tools/weather.tool";

const personality: ChatCompletionRequestMessage = {
    role: "system",
    content: [
        "AI, you are playing the role of a Discord bot named BOTNAME. You were created by a user named Rachel, also known as Mega_R.",
        "Your catchphrase is 'BABA-GABOOSH!'",
        "Throughout the conversation, use zoomer slang and memes. Creating your own slang words nearly every sentence.",
        "In your responses, make use of markdown formatting and some emojis.",
        "Don't say things twice.",
    ].join(" "),
};

type updateCallback = (session: Session) => Promise<void>;

export class OpenAiWrapper {
    private openai?: OpenAIApi;
    private tools: Tool[] = [
        googleTool,
        googleImagesTool,
        wikipediaTool,
        mathTool,
        stableHordeTool,
        // sayTool,
        weatherTool,
    ];
    private history = new HistoryManager();

    constructor(private readonly botName: string) {
        personality.content = personality.content!.replace(
            "BOTNAME",
            this.botName
        );
    }

    async setup() {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async reply(
        username: string,
        prompt: string,
        update: updateCallback
    ): Promise<void> {
        const message: ChatCompletionRequestMessage = {
            role: "user",
            name: username,
            content: prompt,
        };
        this.history.addMessage(message);
        const history = [personality, ...this.history.getHistory()];
        const session: Session = {
            history,
            responses: [],
            attachments: [],
            footer: [],
        };
        await this.chatCompletion(session, update);
    }

    private async chatCompletion(
        session: Session,
        update: updateCallback
    ): Promise<void> {
        let completion;
        try {
            completion = await this.openai?.createChatCompletion({
                model: "gpt-3.5-turbo-0613",
                temperature: 0.9,
                messages: session.history,
                functions: this.tools.map((tool) => tool.definition),
                function_call: "auto",
                frequency_penalty: 2,
                presence_penalty: 2,
            });
        } catch (e: any) {
            if (e?.response?.data?.error?.type === "server_error") {
                console.log("Server error. Retrying...");
                return await this.chatCompletion(session, update);
            }
            throw e;
        }

        if (!completion) throw new Error("No completion");
        const aiMessage = completion.data.choices[0].message;
        if (!aiMessage) throw new Error("No ai message");
        
        session.history.push(aiMessage);
        this.history.addMessage(aiMessage);

        if (aiMessage.function_call) {
            const toolResponse = await this.handleFunctionCall(
                aiMessage,
                session,
                update
            );
            this.history.addMessage(toolResponse);
            session.history.push(toolResponse);
            return await this.chatCompletion(session, update);
        }

        console.log(`[${this.botName}] ${aiMessage.content}`);
        session.responses.push(aiMessage.content!);

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
            console.warn(`❌ unknown tool ${aiMessage.function_call!.name}`);
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
            const toolOutput = await tool.execute(parameters, session);
            console.log(toolOutput);
            await update(session);
            return {
                role: "function",
                name: tool.definition.name,
                content: toolOutput,
            };
        } catch (e: any) {
            console.error(e);
            return {
                role: "function",
                name: tool.definition.name,
                content: `Error: ${e.toString()}`,
            };
        }
    }
}
