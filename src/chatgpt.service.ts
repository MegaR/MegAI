import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';
import { JsonDBService } from './jsondb.service';

interface ChatGPTOptions {
  maxTokens: number;
}

@Injectable()
export class ChatGPTService {
  private openAI: OpenAIApi;

  constructor(
    configService: ConfigService,
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
    options?: ChatGPTOptions,
  ) {
    const model = await this.storage.getModelVersion();
    const completion = await this.openAI.createChatCompletion({
      model: model ? 'gpt-3.5-turbo' : 'gpt-4',
      messages: messages,
      temperature: 1,
      max_tokens: options?.maxTokens,
    });
    return completion.data.choices[0].message.content;
  }
}
