import {
    ChatCompletionRequestMessage,
    ChatCompletionResponseMessage,
    Configuration,
    OpenAIApi,
} from "openai";
import Tool from "./tool.interface";
import replyTool from "./tools/reply.tool";

export class OpenAiWrapper {
    private openai?: OpenAIApi;
    private tools: Tool[] = [replyTool];

    constructor(private readonly botName: string) {}

    async setup() {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async reply(username: string, message: string): Promise<string> {
        return await this.chatCompletion([{ role: "user", name: username, content: message }]);
    }

    private async chatCompletion(messages: ChatCompletionRequestMessage[]): Promise<string> {
        const completion = await this.openai?.createChatCompletion({
            model: "gpt-3.5-turbo-0613",
            temperature: 0.5,
            messages: messages,
            functions: this.tools.map((tool) => tool.definition),
            function_call: "auto",
        });
        if (!completion) throw new Error("No completion");
        const aiMessage = completion.data.choices[0].message;
        if (!aiMessage) throw new Error("No ai message");

        if (aiMessage.function_call) {
            const toolResponse = await this.handleFunctionCall(aiMessage);
            return await this.chatCompletion([...messages, ...toolResponse]);
        }
        return aiMessage.content!;
    }

    private async handleFunctionCall(
        aiMessage: ChatCompletionResponseMessage
    ): Promise<ChatCompletionRequestMessage[]> {
        const tool = this.tools.find(
            (tool) => tool.definition.name === aiMessage.function_call!.name
        );
        if (!tool) throw new Error("No tool found");

        const parameters = JSON.parse(aiMessage.function_call!.arguments!);
        const toolOutput = await tool.execute(parameters);
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
