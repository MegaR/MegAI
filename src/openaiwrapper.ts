import {
    ChatCompletionFunctions,
    ChatCompletionRequestMessage,
    Configuration,
    CreateChatCompletionRequest,
    CreateChatCompletionRequestFunctionCall,
    CreateEmbeddingRequestInput,
    OpenAIApi,
} from "openai";
import Lock from "./lock";

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API,
});
const openai = new OpenAIApi(configuration);
const lock = new Lock();

async function chatCompletion(
    messages: ChatCompletionRequestMessage[],
    options?: Partial<CreateChatCompletionRequest>,
) {
    await lock.acquire();
    try {
        const completion = await openai?.createChatCompletion({
            model: process.env.GPT_MODEL || "gpt-3.5-turbo-0613",
            temperature: 0.5,
            messages,
            frequency_penalty: 2,
            presence_penalty: 2,
            ...options,
        });
        return completion.data.choices?.[0].message;
    } finally {
        lock.release();
    }
}

async function instruct(prompt: string) {
    await lock.acquire();
    try {
        const completion = await openai?.createCompletion({
            model: "gpt-3.5-turbo-instruct",
            max_tokens: 512,
            temperature: 1,
            prompt,
        });
        return completion.data.choices?.[0].text;
    } finally {
        lock.release();
    }
}

async function embedding(input: CreateEmbeddingRequestInput) {
    await lock.acquire();
    try {
        const embedding = await openai.createEmbedding({
            input,
            model: "text-embedding-ada-002",
        });
        return embedding.data.data;
    } finally {
        lock.release();
    }
}

export const ai = { chatCompletion, embedding, instruct };
