import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { AiOptions, AiInterface } from './ai.interface';

export class ChatGPT implements AiInterface {
  private readonly logger = new Logger(ChatGPT.name);
  private openAI: OpenAIApi;

  constructor(
    configService: ConfigService,
    private readonly model: 'gpt-3.5-turbo' | 'gpt-4',
  ) {
    const token = configService.getOrThrow('OPENAI_API');
    const configuration = new Configuration({
      apiKey: token,
    });
    this.openAI = new OpenAIApi(configuration);
  }

  async complete(
    messages: Array<ChatCompletionRequestMessage>,
    options: AiOptions,
  ) {
    try {
      const completion = await this.openAI.createChatCompletion({
        model: this.model,
        messages: messages,
        temperature: 1,
        max_tokens: options?.maxTokens,
      });
      return completion.data.choices[0].message?.content ?? '';
    } catch (e) {
      this.logger.error(e);
      return '❌Failed to contact OpenAI';
    }
  }
}
