import OpenAI from "openai";
import Lock from "./lock";
import { ChatCompletionCreateParamsNonStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getLogger } from "./logger";
import { MessageCreateParams } from "openai/resources/beta/threads/messages/messages";
import { RunSubmitToolOutputsParams } from "openai/resources/beta/threads/runs/runs";
import { AssistantUpdateParams } from "openai/resources/beta/assistants/assistants";
import { Uploadable, toFile } from "openai/uploads";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API,
});
const lock = new Lock();
const logger = getLogger('openai');

async function updateAssistant(params: AssistantUpdateParams) {
    await lock.acquire();
    try {
        await openai.beta.assistants.update(process.env.OPENAI_ASSISTANT!, params);
    } finally {
        lock.release();
    }
}
async function createThread() {
    await lock.acquire();
    try {
        const thread = await openai.beta.threads.create();
        return thread.id;
    } finally {
        lock.release();
    }
}

async function addMessage(threadId: string, message: MessageCreateParams) {
    await lock.acquire();
    try {
        return await openai.beta.threads.messages.create(threadId, message);
    } finally {
        lock.release();
    }
}

async function assistantCompletion(threadId: string, instructions: string | undefined) {
    await lock.acquire();
    try {
        const run = await openai.beta.threads.runs.create(
            threadId,
            {
                assistant_id: process.env.OPENAI_ASSISTANT!,
                instructions,
            }
        );

        return run;
    } finally {
        lock.release();
    }
}

async function getRun(threadId: string, runId: string) {
    await lock.acquire();
    try {
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);
        return run;
    } finally {
        lock.release();
    }
}

async function cancelRun(threadId: string, runId: string) {
    await lock.acquire();
    try {
        await openai.beta.threads.runs.cancel(threadId, runId);
    } finally {
        lock.release();
    }
}

async function submitToolOutputs(threadId: string, runId: string, toolOutputs: Array<RunSubmitToolOutputsParams.ToolOutput>) {
    await lock.acquire();
    try {
        const run = await openai.beta.threads.runs.submitToolOutputs(
            threadId,
            runId,
            {
                tool_outputs: toolOutputs,
            }
        );
        return run;
    } finally {
        lock.release();
    }
}

async function getMessages(threadId: string, after?: string) {
    await lock.acquire();
    try {
        const messages = await openai.beta.threads.messages.list(threadId, { after, order: 'asc' });
        return messages.data;
    } finally {
        lock.release();
    }
}

async function createFile(file: ArrayBuffer) {
    await lock.acquire();
    try {
        const result = await openai.files.create({
            file: await toFile(file),
            purpose: 'assistants',
        });
        return result.id;
    } finally {
        lock.release();
    }
}

async function deleteFile(fileId: string) {
    await lock.acquire();
    try {
        await openai.files.del(fileId);
    } finally {
        lock.release();
    }
}

async function retrieveFile(fileId: string) {
    await lock.acquire();
    try {
        return await (await openai.files.content(fileId)).arrayBuffer();
    } finally {
        lock.release();
    }
}

async function getRunSteps(threadId: string, runId: string) {
    await lock.acquire();
    try {
        return (await openai.beta.threads.runs.steps.list(threadId, runId)).data;
    } finally {
        lock.release();
    }
}

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

export const ai = {
    chatCompletion,
    embedding,
    instruct,
    dalle,
    updateAssistant,
    createThread,
    addMessage,
    assistantCompletion,
    getRun,
    submitToolOutputs,
    getMessages,
    cancelRun,
    createFile,
    deleteFile,
    retrieveFile,
    getRunSteps,
};
