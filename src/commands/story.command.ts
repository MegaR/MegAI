import { SlashCommandPipe } from '@discord-nestjs/common';
import {
  Command,
  Handler,
  InjectDiscordClient,
  InteractionEvent,
  Param,
  ParamType,
} from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { Client, CommandInteraction, MessageManager } from 'discord.js';
import { ChatGPTService } from 'src/chatgpt.service';

class StoryCommandOptions {
  @Param({ description: 'User', required: true, type: ParamType.USER })
  user: string;
  @Param({ description: 'Theme' })
  theme: string;
}

@Command({
  name: 'story',
  description: 'Get a story about someone',
})
@Injectable()
export class StoryCommand {
  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly chatGPT: ChatGPTService,
  ) {}

  @Handler()
  async onStoryCommand(
    @InteractionEvent(SlashCommandPipe) { user, theme }: StoryCommandOptions,
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    const userObj = await this.client.users.fetch(user);
    const username = userObj.username;
    const messageManager: MessageManager = (
      interaction.channel as unknown as any
    ).messages;
    const messages = (await messageManager.fetch())
      .filter(
        (message) =>
          message.author.id === user || message.mentions.has(userObj),
      )
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map(
        (message) =>
          `[${message.createdAt.toLocaleString()}] ${
            message.author.username
          }: ${message.cleanContent}`,
      );
    //reduce the amount of messages
    while (messages.length > 5) {
      messages.splice(Math.floor(Math.random() * messages.length - 1), 1);
    }
    const completion = await this.chatGPT.complete([
      {
        role: 'user',
        content: `Discord messages:
${messages.join('\n')}`,
      },
      {
        role: 'user',
        content: `Make a short ${
          theme ?? ''
        } story about ${username}. Involve the content of the messages. You can use emojis`,
      },
    ]);
    await interaction.editReply(completion);
  }
}
