import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPT } from 'src/ai/chatgpt.ai';
import { JsonDBService } from 'src/jsondb.service';
import { AiOptions, AiInterface } from './aiservice.interface';
import Llama from './llama.ai';

@Injectable()
export class AiService {
  private service: AiInterface;

  constructor(
    private readonly configService: ConfigService,
    private readonly storage: JsonDBService,
  ) {
    // this.service = new ChatGPTService(configService, storage);
    this.service = new Llama();
  }

  async complete(
    messages: Array<ChatCompletionRequestMessage>,
    options?: AiOptions,
  ) {
    return await this.service.complete(messages, options);
  }
}
