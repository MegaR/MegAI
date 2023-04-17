import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPT } from 'src/ai/chatgpt.ai';
import { JsonDBService } from 'src/jsondb.service';
import { AiOptions, AiInterface } from './ai.interface';
import Llama from './llama.ai';
import { Client } from 'discord.js';
import { InjectDiscordClient } from '@discord-nestjs/core';

@Injectable()
export class AiService {
  private llama: AiInterface;
  private chatGpt3: AiInterface;
  private chatGpt4: AiInterface;

  constructor(
    configService: ConfigService,
    private readonly storage: JsonDBService,
    @InjectDiscordClient() private readonly discordClient: Client,
  ) {
    this.llama = new Llama();
    this.chatGpt3 = new ChatGPT(configService, 'gpt-3.5-turbo');
    this.chatGpt4 = new ChatGPT(configService, 'gpt-4');
  }

  async complete(
    messages: Array<ChatCompletionRequestMessage>,
    options?: AiOptions,
    progressCallback?: (progress: string) => void,
  ) {
    const model = await this.storage.getModelVersion();
    const botName = this.discordClient.user.username;

    let ai: AiInterface;
    switch (model) {
      case 'llama':
        ai = this.llama;
        break;
      default:
      case '3':
        ai = this.chatGpt3;
        break;
      case '4':
        ai = this.chatGpt4;
        break;
    }
    return await ai.complete(
      messages,
      {
        ...options,
        botName: botName,
      },
      progressCallback,
    );
  }
}
