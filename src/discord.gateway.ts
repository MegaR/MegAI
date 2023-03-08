import { InjectDiscordClient, On, Once } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Message } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPTService } from './chatgpt.service';
import { JsonDBService } from './jsondb.factory';

@Injectable()
export class DiscordGateway {
  private readonly logger = new Logger(DiscordGateway.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly chatGPT: ChatGPTService,
    private readonly db: JsonDBService,
  ) {}

  @Once('ready')
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }

  @On('messageCreate')
  async onMessage(message: Message) {
    const isMentioned = message.mentions.users.has(this.client.user.id);
    if (!isMentioned) return;
    await this.mentioned(message);
  }

  async mentioned(message: Message) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    message.channel.sendTyping();
    const history = await this.getHistory(message);
    const systemPrompt = await this.getSystemMessage();
    // const user = message.author.username;
    const completion = await this.chatGPT.complete([systemPrompt, ...history]); //, { user });
    message.reply(completion);
  }

  async getSystemMessage(): Promise<ChatCompletionRequestMessage> {
    const prompt = (await this.db.getData('/systemPrompt')) as string;
    return { role: 'system', content: prompt };
  }

  async getHistory(message: Message) {
    let history = [];
    if (message.reference) {
      const parent = await message.fetchReference();
      history = await this.getHistory(parent);
    }
    const role =
      message.author.id === this.client.user.id ? 'assistant' : 'user';
    const text = message.cleanContent
      .replace('@' + this.client.user.username, '')
      .trim();
    history = [...history, { role, content: text }];
    return history;
  }
}
