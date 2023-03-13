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

@Command({
  name: 'summary',
  description: 'Get a summary of the message history',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class SummarizerCommand {
  constructor(private readonly chatGPT: ChatGPTService) {}

  @Handler()
  async onSummarizeCommand(
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    const messageManager: MessageManager = (
      interaction.channel as unknown as any
    ).messages;
    const messages = await messageManager.fetch({ limit: 20 });
    const history: ChatCompletionRequestMessage[] = messages.map((message) => ({
      role: 'user',
      name: message.author.username,
      content: message.cleanContent,
    }));
    console.log(history);
    const completion = await this.chatGPT.complete([
      ...history,
      {
        role: 'system',
        content: `You are a summarizer. Summarize all messages`,
      },
    ]);
    await interaction.editReply(completion);
  }
}
