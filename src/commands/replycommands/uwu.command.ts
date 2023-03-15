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
  name: 'uwu',
  type: ApplicationCommandType.Message,
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class UwuCommand {
  constructor(private readonly chatGPT: ChatGPTService) {}

  @Handler()
  async onAccentCommand(
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
        content: [
          'Re-do the last reply with the following requirements:',
          'Use an uwu accent',
          'Make it sound cute',
          'Fill the text and end every sentence with cute action like **smiles**',
          'Use a lot of emojis',
        ].join('\n'),
      },
    ]);
    const reply = await message.reply(completion);
    await reply.react('😺');
    await interaction.editReply(`😺UwU😺`);
  }
}
