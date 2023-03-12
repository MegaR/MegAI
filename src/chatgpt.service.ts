import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage, Configuration, OpenAIApi } from 'openai';

interface ChatGPTOptions {
  maxTokens: number;
}

@Injectable()
export class ChatGPTService {
  private openAI: OpenAIApi;

  constructor(configService: ConfigService) {
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
    const completion = await this.openAI.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: messages,
      temperature: 1,
      max_tokens: options?.maxTokens,
    });
    return completion.data.choices[0].message.content;
  }
}
