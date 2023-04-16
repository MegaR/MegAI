import { ChatCompletionRequestMessage } from 'openai';

export interface AiOptions {
  maxTokens?: number;
  model?: 3 | 4;
}

export interface AiServiceInterface {
  complete(
    messages: Array<ChatCompletionRequestMessage>,
    options?: AiOptions,
  ): Promise<string>;
}
