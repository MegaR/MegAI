import OpenAI from "openai";

export default class OpenAIService {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
  }

  async createChatCompletion(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ) {
    const response = await this.client.chat.completions.create({
      model: options?.model || "gpt-3.5-turbo",
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    return response;
  }
}
