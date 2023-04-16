import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import {
  CommandInteraction,
  MessageManager,
  PermissionFlagsBits,
} from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';
import { AiService } from 'src/ai/ai.service';

@Command({
  name: 'summary',
  description: 'Get a summary of the message history',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class SummarizerCommand {
  constructor(private readonly aiService: AiService) {}

  @Handler()
  async onSummarizeCommand(
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    const messageManager: MessageManager = (
      interaction.channel as unknown as any
    ).messages;
    let messages = await messageManager.fetch();
    messages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
    const history: ChatCompletionRequestMessage[] = messages.map((message) => ({
      role: 'user',
      name: message.author.username,
      content: message.cleanContent,
    }));

    //api request fails if there are to many tokens
    while (this.countCharacters(history) > 4000) {
      history.splice(0, 1);
    }

    const completion = await this.aiService.complete([
      ...history,
      {
        role: 'system',
        content: `You are a summarizer. Summarize all messages and add a joke about the content at the end. You can use emojis`,
      },
    ]);
    await interaction.editReply(completion);
  }

  countCharacters(history: ChatCompletionRequestMessage[]) {
    return history.reduce((prev, current) => {
      return prev + current.content.length;
    }, 0);
  }
}
