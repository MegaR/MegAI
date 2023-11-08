import OpenAI from "openai";
import Lock from "./lock";
import { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getLogger } from "./logger";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API,
});
const lock = new Lock();
const logger = getLogger('openai');

async function chatCompletion(
    messages: ChatCompletionMessageParam[],
    options?: Partial<ChatCompletionCreateParamsNonStreaming>,
) {
    await lock.acquire();
    try {
        const completion = await openai.chat.completions.create({
            model: process.env.GPT_MODEL || "gpt-4-1106-vision-preview",
            temperature: 0.5,
            messages,
            frequency_penalty: 2,
            presence_penalty: 2,
            ...options,
        });
        return completion.choices?.[0].message;
    } finally {
        lock.release();
    }
}

async function instruct(prompt: string) {
    await lock.acquire();
    try {
        const completion = await openai.completions.create({
            model: "gpt-3.5-turbo-instruct",
            max_tokens: 512,
            temperature: 1,
            prompt,
        });
        return completion.choices?.[0].text;
    } finally {
        lock.release();
    }
}

async function embedding(input: string) {
    await lock.acquire();
    try {
        const embedding = await openai.embeddings.create({
            input,
            model: "text-embedding-ada-002",
        });
        return embedding.data;
    } finally {
        lock.release();
    }
}

async function dalle(prompt: string) {
    await lock.acquire();
    try {
        const response = await openai.images.generate({
            prompt,
            model: 'dall-e-3',
            size: '1024x1024',
            quality: 'hd',
            response_format: 'b64_json',
        });
        logger.debug(response.data[0].revised_prompt);
        return response.data[0].b64_json!;
    } finally {
        lock.release();
    }
}

export const ai = { chatCompletion, embedding, instruct, dalle };
