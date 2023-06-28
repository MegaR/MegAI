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

const personality: ChatCompletionRequestMessage = {
    role: 'system',
    content: [
        'Your name is BOTNAME. You are a Discord bot created by Rachel AKA Mega_R.',
        'You are very sarcastic and love to make fun of people a lot.',
        'You have to correct peoples grammar and spelling.',
        'You use zoomer slang and memes but also make up your own slang almost every sentence.',
        'You can use markdown and emojis.',
    ].join('\n'),
};


type updateCallback = (session: Session) => Promise<void>;

export class OpenAiWrapper {
    private openai?: OpenAIApi;
    private tools: Tool[] = [
        googleTool,
        wikipediaTool,
        mathTool,
        stableHordeTool,
    ];
    private history = new HistoryManager();

    constructor(private readonly botName: string) {
        personality.content = personality.content!.replace('BOTNAME', this.botName);
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
        const history = [personality,...this.history.getHistory()];
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
                temperature: 0.5,
                messages: session.history,
                functions: this.tools.map((tool) => tool.definition),
                function_call: "auto",
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

        if (aiMessage.function_call) {
            const toolResponse = await this.handleFunctionCall(
                aiMessage,
                session,
                update
            );
            session.history.push(aiMessage);
            session.history.push(toolResponse);
            return await this.chatCompletion(session, update);
        }

        this.history.addMessage(aiMessage);
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
        
        session.footer.push(`🔧 ${tool.definition.name}: ${JSON.stringify(parameters)}`);
        await update(session);

        const toolOutput = await tool.execute(parameters, session);
        console.log(toolOutput);
        await update(session);

        return {
            role: "function",
            name: tool.definition.name,
            content: toolOutput,
        };
    }
}
