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
  private service: AiInterface;

  constructor(
    private readonly configService: ConfigService,
    private readonly storage: JsonDBService,
    @InjectDiscordClient() private readonly discordClient: Client,
  ) {
    // this.service = new ChatGPTService(configService, storage);
    this.service = new Llama();
  }

  async complete(
    messages: Array<ChatCompletionRequestMessage>,
    options?: AiOptions,
  ) {
    const botName = this.discordClient.user.username;
    return await this.service.complete(messages, {
      ...options,
      botName: botName,
    });
  }
}
