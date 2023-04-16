import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPTService } from 'src/chatgpt.service';
import { JsonDBService } from 'src/jsondb.service';
import { AiOptions, AiServiceInterface } from './aiservice.interface';

@Injectable()
export class AiService {
  private service: AiServiceInterface;

  constructor(
    private readonly configService: ConfigService,
    private readonly storage: JsonDBService,
  ) {
    this.service = new ChatGPTService(configService, storage);
  }

  async complete(
    messages: Array<ChatCompletionRequestMessage>,
    options?: AiOptions,
  ) {
    return await this.service.complete(messages, options);
  }
}
