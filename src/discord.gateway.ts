import { InjectDiscordClient, On, Once } from '@discord-nestjs/core';
import { Injectable, Logger } from '@nestjs/common';
import { Client, Message, MessageManager } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPTService } from './chatgpt.service';
import { JsonDBService } from './jsondb.service';
import { chunkReply } from './utils/chunkreply';
import { getHistory } from './utils/gethistory';
import { sendTyping } from './utils/sendtyping';

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
    //return if the message was from a bot itself
    if (message.author.bot) {
      return;
    }
    if (message.content === '!uwu') {
      await this.uwu(message);
      return;
    }

    const isMentioned = message.mentions.users.has(this.client.user.id);
    if (isMentioned) {
      await this.mentioned(message);
    } else if (Math.random() < 0.01) {
      await this.randomResponse(message);
    }
  }

  async mentioned(message: Message) {
    sendTyping(message.channel);
    const history = await getHistory(message);
    const systemPrompt = await this.getSystemMessage(message);
    const completion = await this.chatGPT.complete([systemPrompt, ...history]);
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

    const systemPrompt: ChatCompletionRequestMessage = {
      role: 'system',
      content:
        'You are a person on Discord. You can use emojis. You give short and clever responses.',
    };
    const completion = await this.chatGPT.complete([systemPrompt, ...history], {
      maxTokens: 100,
    });
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

  async uwu(message: Message) {
    sendTyping(message.channel);
    if (!message.reference) {
      await message.reply('The uwu command only works as a reply');
      return;
    }

    const ref = await message.fetchReference();
    const history = await getHistory(ref, {
      botId: ref.author.id,
    });
    const completion = await this.chatGPT.complete([
      ...history,
      {
        role: 'system',
        content: [
          'Rewrite the last message with the following requirements:',
          'Use an uwu accent',
          'Make it sound cute',
          'Fill the text and end every sentence with cute action like **smiles**',
          'Use a lot of emojis',
        ].join('\n'),
      },
    ]);
    const reply = await ref.reply(completion);
    await reply.react('😺');
  }
}
