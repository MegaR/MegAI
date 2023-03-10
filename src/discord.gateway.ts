import { InjectDiscordClient, On, Once } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Message } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPTService } from './chatgpt.service';
import { JsonDBService } from './jsondb.service';

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
    if (isMentioned) {
      await this.mentioned(message);
    } else if (Math.random() < 1) {
      await this.emojiReaction(message);
    }
  }

  async mentioned(message: Message) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    message.channel.sendTyping();
    const history = await this.getHistory(message);
    //trim history
    while (history.length > 10) {
      history.splice(0, 1);
    }
    const systemPrompt = await this.getSystemMessage(message);
    const completion = await this.chatGPT.complete([systemPrompt, ...history]);
    message.reply(completion);
  }

  async getSystemMessage(
    message: Message,
  ): Promise<ChatCompletionRequestMessage> {
    let prompt = '';
    try {
      prompt =
        (await this.db.getData(
          `/guild/${message.guild.id}/channel/${message.channel.id}/user/${message.author.id}/systemPrompt`,
        )) + '. ';
    } catch (error) {
      //No prompt found.
    }
    const username = message.author.username;
    const postPrompt = `The user's name is ${username}. You can use emojis.`;
    return { role: 'system', content: prompt + postPrompt };
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

  async emojiReaction(message: Message) {
    const messages: ChatCompletionRequestMessage[] = [
      {
        role: 'system',
        content: 'You give short responses with only discord emojis.',
      },
      { role: 'user', content: message.cleanContent },
    ];
    const reaction = await this.chatGPT.complete(messages);
    for (const emoji of [...reaction]) {
      try {
        await message.react(emoji);
      } catch (error) {
        this.logger.warn('failed to react', reaction, error);
      }
    }
  }
}
