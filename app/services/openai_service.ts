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

  async createChatCompletionWithImages(
    textContent: string,
    imageUrls: string[],
    conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ) {
    // Use the configured default model (assumed to be vision-capable)
    const model = options?.model || this.defaultModel;
    // Build the current message content with text and images
    const currentMessageContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] =
      [];

    if (textContent.trim()) {
      currentMessageContent.push({
        type: "text",
        text: textContent,
      });
    }

    // Add images to content
    for (const imageUrl of imageUrls) {
      currentMessageContent.push({
        type: "image_url",
        image_url: {
          url: imageUrl,
        },
      });
    }

    // Build messages array with conversation history + current message
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...conversationHistory,
      {
        role: "user",
        content: currentMessageContent,
      },
    ];

    const response = await this.client.chat.completions.create({
      model,
      messages,
      temperature: options?.temperature,
      max_tokens: options?.maxTokens || 2000, // Higher default for vision responses
    });

    return response;
  }
}
