import { ChatCompletionRequestMessage } from 'openai';

export interface AiOptions {
  maxTokens?: number;
  model?: 3 | 4;
  botName?: string;
}

export interface AiInterface {
  complete(
    messages: Array<ChatCompletionRequestMessage>,
    options: AiOptions,
  ): Promise<string>;
}
