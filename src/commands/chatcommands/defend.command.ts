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
import { AiService } from 'src/ai/ai.service';

class DefendCommandOptions {
  @Param({ description: 'User', required: true, type: ParamType.USER })
  user: string;
}

@Command({
  name: 'defend',
  description: 'Write a defence for somebody',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class DefendCommand {
  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly aiService: AiService,
  ) {}

  @Handler()
  async onDefendCommand(
    @InteractionEvent(SlashCommandPipe) { user }: DefendCommandOptions,
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
    const completion = await this.aiService.complete([
      ...messages,
      {
        role: 'user',
        content: `Defend ${username}. Involve the content of the messages. You can use emojis`,
      },
    ]);
    await interaction.editReply(completion);
  }
}
