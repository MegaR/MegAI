import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import {
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { AiService } from 'src/ai/ai.service';
import { getHistory } from 'src/utils/gethistory';

@Command({
  name: 'comeback',
  type: ApplicationCommandType.Message,
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class ComebackCommand {
  constructor(private readonly aiService: AiService) {}

  @Handler()
  async onComebackCommand(
    @InteractionEvent() interaction: MessageContextMenuCommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    const message = interaction.targetMessage;
    const history = await getHistory(message, {
      botId: message.author.id,
    });
    const completion = await this.aiService.complete([
      ...history,
      {
        role: 'system',
        content:
          'Write a clever comeback to previous message. You can use emojis.',
      },
    ]);
    const reply = await message.reply(completion);
    await reply.react('🔥');
    await interaction.editReply('🔥Comeback🔥');
  }
}
