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

type progressCallback = (update: string) => Promise<void>;

export class OpenAiWrapper {
    private openai?: OpenAIApi;
    private tools: Tool[] = [
        googleTool,
        wikipediaTool,
        mathTool,
        stableHordeTool,
    ];
    private history = new HistoryManager();

    constructor(private readonly botName: string) {}

    async setup() {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async reply(
        username: string,
        prompt: string,
        progress: progressCallback
    ): Promise<string> {
        const message: ChatCompletionRequestMessage = {
            role: "user",
            name: username,
            content: prompt,
        };
        this.history.addMessage(message);
        return await this.chatCompletion(this.history.getHistory(), progress);
    }

    private async chatCompletion(
        messages: ChatCompletionRequestMessage[],
        progress: progressCallback
    ): Promise<string> {
        let completion;
        try {
            completion = await this.openai?.createChatCompletion({
                model: "gpt-3.5-turbo-0613",
                temperature: 0.5,
                messages: messages,
                functions: this.tools.map((tool) => tool.definition),
                function_call: "auto",
            });
        } catch (e: any) {
            if (e?.response?.data?.error?.type === "server_error") {
                console.log("Server error. Retrying...");
                return await this.chatCompletion(messages, progress);
            }
            throw e;
        }

        if (!completion) throw new Error("No completion");
        const aiMessage = completion.data.choices[0].message;
        if (!aiMessage) throw new Error("No ai message");

        if (aiMessage.function_call) {
            const toolResponse = await this.handleFunctionCall(
                aiMessage,
                progress
            );
            return await this.chatCompletion(
                [...messages, ...toolResponse],
                progress
            );
        }

        this.history.addMessage(aiMessage);
        console.log(`[${this.botName}] ${aiMessage.content}`);
        return aiMessage.content!;
    }

    private async handleFunctionCall(
        aiMessage: ChatCompletionResponseMessage,
        progress: progressCallback
    ): Promise<ChatCompletionRequestMessage[]> {
        const tool = this.tools.find(
            (tool) => tool.definition.name === aiMessage.function_call!.name
        );
        if (!tool) {
            console.warn(`❌ unknown tool ${aiMessage.function_call!.name}`);
            return [
                aiMessage,
                {
                    role: "function",
                    name: aiMessage.function_call!.name,
                    content: '❌ unknown function',
                },
            ];
        }
        const parameters = JSON.parse(aiMessage.function_call!.arguments!);

        console.log(
            `🔧 ${tool.definition.name}: ${JSON.stringify(parameters)}`
        );
        await progress(
            `🔧 ${tool.definition.name}: \`${JSON.stringify(parameters)}\``
        );

        const toolOutput = await tool.execute(parameters);
        console.log(toolOutput);

        return [
            aiMessage,
            {
                role: "function",
                name: tool.definition.name,
                content: toolOutput,
            },
        ];
    }
}
