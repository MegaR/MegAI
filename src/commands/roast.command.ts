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
import {
  Client,
  CommandInteraction,
  MessageManager,
  PermissionFlagsBits,
} from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { ChatGPTService } from 'src/chatgpt.service';

class RoastCommandOptions {
  @Param({ description: 'User', required: true, type: ParamType.USER })
  user: string;
}

@Command({
  name: 'roast',
  description: 'Write a Roast about somebody',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class RoastCommand {
  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly chatGPT: ChatGPTService,
  ) {}

  @Handler()
  async onRoastCommand(
    @InteractionEvent(SlashCommandPipe) { user }: RoastCommandOptions,
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    const userObj = await this.client.users.fetch(user);
    const username = userObj.username;
    const messageManager: MessageManager = (
      interaction.channel as unknown as any
    ).messages;
    const messages: ChatCompletionRequestMessage[] = (
      await messageManager.fetch()
    )
      .filter((message) => message.author.id === user)
      .sort((a, b) => a.createdTimestamp - b.createdTimestamp)
      .map((message) => ({
        role: message.author.bot ? 'assistant' : 'user',
        name: message.author.username,
        content: message.cleanContent,
      }));
    //reduce the amount of messages
    while (messages.length > 10) {
      messages.splice(0, 1);
    }
    const completion = await this.chatGPT.complete([
      ...messages,
      {
        role: 'user',
        content: `Write a funny non-offensive roast about ${username}. Involve the content of the messages. You can use emojis`,
      },
    ]);
    await interaction.editReply(completion);
  }
}
