import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { AiOptions, AiInterface } from './aiservice.interface';
import { JsonDBService } from '../jsondb.service';

export class ChatGPT implements AiInterface {
  private readonly logger = new Logger(ChatGPT.name);
  private openAI: OpenAIApi;

  constructor(
    private readonly configService: ConfigService,
    private readonly storage: JsonDBService,
  ) {
    const token = configService.getOrThrow('OPENAI_API');
    const configuration = new Configuration({
      apiKey: token,
    });
    this.openAI = new OpenAIApi(configuration);
  }

  async complete(
    messages: Array<ChatCompletionRequestMessage>,
    options?: AiOptions,
  ) {
    try {
      const model = options?.model || (await this.storage.getModelVersion());
      const completion = await this.openAI.createChatCompletion({
        model: model === 3 ? 'gpt-3.5-turbo' : 'gpt-4',
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
