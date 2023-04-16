import { SlashCommandPipe } from '@discord-nestjs/common';
import {
  Command,
  Handler,
  InjectDiscordClient,
  InteractionEvent,
  Param,
} from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { Client, CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { AiService } from 'src/ai/ai.service';

class EightballCommandOptions {
  @Param({ description: 'Question', required: true })
  question: string;
}

@Command({
  name: 'eightball',
  description: 'Write a prediction about something',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class EightballCommand {
  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly aiService: AiService,
  ) {}

  @Handler()
  async onEightballCommand(
    @InteractionEvent(SlashCommandPipe) { question }: EightballCommandOptions,
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    //reduce the amount of messages
    const completion = await this.aiService.complete([
      {
        role: 'system',
        content: `You are a magic eightball. You make up a prediction based on the users question`,
      },
      {
        role: 'user',
        content: `My name is ${interaction.user.username}. ${question}`,
      },
    ]);
    await interaction.editReply(`Question: ${question}\nAnswer: ${completion}`);
  }
}
