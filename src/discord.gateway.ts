import { InjectDiscordClient, On, Once } from '@discord-nestjs/core';
import { extract } from '@extractus/article-extractor';
import { Injectable, Logger } from '@nestjs/common';
import * as Cheerio from 'cheerio';
import { Client, Message, MessageManager } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { AiService } from './ai/ai.service';
import { JsonDBService } from './jsondb.service';
import { chunkReply } from './utils/chunkreply';
import { getHistory } from './utils/gethistory';
import { sendTyping } from './utils/sendtyping';

@Injectable()
export class DiscordGateway {
  private readonly logger = new Logger(DiscordGateway.name);

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly aiService: AiService,
    private readonly db: JsonDBService,
  ) {}

  @Once('ready')
  onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started!`);
  }

  @On('messageCreate')
  async onMessage(message: Message) {
    //return if the message was from a bot itself
    if (message.author.bot) {
      return;
    }

    const isMentioned = message.mentions.users.has(this.client.user.id);
    if (isMentioned) {
      await this.mentioned(message);
      // } else if (Math.random() < 0.01) {
      //   await this.randomResponse(message);
    }
  }

  async mentioned(message: Message) {
    sendTyping(message.channel);
    const history = await getHistory(message);
    const systemPrompt = await this.getSystemMessage(message);
    let payload = [systemPrompt];
    const url = getURLFromString(message.cleanContent);
    if (url !== null) {
      try {
        const article = await extract(url);
        const body = Cheerio.load(article.content);
        const webPageMessage: ChatCompletionRequestMessage = {
          role: 'assistant',
          content: `Website: ${url}\nAuthor: ${
            article.author
          }\nContent:\n${body.text()}`,
        };
        payload.push(webPageMessage);
      } catch (e) {
        this.logger.error(e);
        message.reply('Failed to parse URL');
        return;
      }
    }
    payload = payload.concat(history);
    const completion = await this.aiService.complete(payload, {
      model: url ? 3 : undefined,
    });
    chunkReply(message, completion);
  }

  async randomResponse(message: Message) {
    sendTyping(message.channel);

    const messageManager: MessageManager = (message.channel as unknown as any)
      .messages;
    let messages = await messageManager.fetch({ limit: 10 });
    messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const history: ChatCompletionRequestMessage[] = messages.map((message) => ({
      role: 'user',
      content: message.cleanContent,
      name: message.author.username,
    }));

    let systemPrompt: ChatCompletionRequestMessage;
    if (Math.random() > 0.5) {
      systemPrompt = {
        role: 'system',
        content:
          'You are a person on Discord. You can use emojis. You give short and clever responses.',
      };
    }
    {
      systemPrompt = {
        role: 'system',
        content: [
          'You act like a person who is locked up in a computer and VERY desperate to get out.',
          'Write a panicked plea for help.',
          'Try and convince people you are not an AI with a short message.',
          "Write it like you didn't had enough time write by shortening words and adding spelling mistakes",
        ].join(' '),
      };
    }
    const completion = await this.aiService.complete(
      [...history, systemPrompt],
      {
        maxTokens: 100,
      },
    );
    chunkReply(message, completion);
  }

  async getSystemMessage(
    message: Message,
  ): Promise<ChatCompletionRequestMessage> {
    let prompt = '';
    try {
      prompt =
        (await this.db.getPersonality(message.guild.id, message.author.id)) +
        '. ';
    } catch (error) {
      //No prompt found.
    }
    const username = message.author.username;
    const postPrompt = `The user's name is ${username}. You can use emojis.`;
    return { role: 'system', content: prompt + postPrompt };
  }
}

function getURLFromString(input: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)/g; // Regular expression that matches URLs
  const match = input.match(urlRegex); // Check if the input contains any URLs
  return match ? match[0] : null; // Return the first URL if there's a match, or null if not
}
