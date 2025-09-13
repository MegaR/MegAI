import OpenAI from "openai";

export default class OpenAIService {
  private client: OpenAI;
  private defaultModel: string;

  constructor(apiKey: string, baseURL?: string, model?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.defaultModel = model || "gpt-3.5-turbo";
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
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens,
    });

    return response;
  }
}
