import { Command, Handler, InteractionEvent } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import {
  ApplicationCommandType,
  MessageContextMenuCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { ChatGPTService } from 'src/chatgpt.service';
import { getHistory } from 'src/utils/gethistory';

@Command({
  name: 'reply',
  type: ApplicationCommandType.Message,
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class ReplyCommand {
  constructor(private readonly chatGPT: ChatGPTService) {}

  @Handler()
  async onCommand(
    @InteractionEvent() interaction: MessageContextMenuCommandInteraction,
  ) {
    await interaction.deferReply({ ephemeral: false });
    const message = interaction.targetMessage;
    const history = await getHistory(message, {
      botId: message.author.id,
    });
    const completion = await this.chatGPT.complete([
      ...history,
      {
        role: 'system',
        content:
          'You are a person on Discord. You can use emojis. You give short and clever responses.',
      },
    ]);
    const reply = await message.reply(completion);
    await reply.react('💬');
    await interaction.editReply('💬Reply💬');
  }
}
