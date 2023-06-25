import { Configuration, OpenAIApi } from "openai";

export class OpenAiWrapper {
    private openai?: OpenAIApi;

    async setup() {
        const configuration = new Configuration({
            apiKey: process.env.OPENAI_API,
        });
        this.openai = new OpenAIApi(configuration);
    }

    async reply(username: string, message: string): Promise<string> {
        const completion = await this.openai?.createChatCompletion({
            model: "gpt-3.5-turbo",
            temperature: 0.5,
            messages: [{ role: "user", name: username, content: message }],
        });

        return completion!.data.choices[0].message!.content!;
    }
}
