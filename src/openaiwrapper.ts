import {
    ChatCompletionFunctions,
    ChatCompletionRequestMessage,
    Configuration,
    CreateChatCompletionRequestFunctionCall,
    CreateEmbeddingRequestInput,
    OpenAIApi,
} from "openai";

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API,
});
const openai = new OpenAIApi(configuration);

async function chatCompletion(
    messages: ChatCompletionRequestMessage[],
    functions?: ChatCompletionFunctions[],
    functionCall: CreateChatCompletionRequestFunctionCall = "auto"
) {
    const completion = await openai?.createChatCompletion({
        model: process.env.GPT_MODEL || "gpt-3.5-turbo-0613",
        temperature: 0.5,
        messages,
        functions,
        function_call: functionCall,
        frequency_penalty: 2,
        presence_penalty: 2,
    });
    return completion.data.choices?.[0].message;
}

async function embedding(input: CreateEmbeddingRequestInput) {
    const embedding = await openai.createEmbedding({
        input,
        model: "text-embedding-ada-002",
    });
    return embedding.data.data;
}

export const ai = { chatCompletion, embedding };
