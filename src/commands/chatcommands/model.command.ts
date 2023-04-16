import { SlashCommandPipe } from '@discord-nestjs/common';
import {
  Command,
  Handler,
  InteractionEvent,
  Param,
  ParamType,
} from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { JsonDBService } from 'src/jsondb.service';

class CommandOptions {
  @Param({ description: '3 or 4', required: true, type: ParamType.NUMBER })
  model: number;
}

@Command({
  name: 'model',
  description: 'Change the GPT model',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class ModelCommand {
  constructor(
    private readonly configService: ConfigService,
    private readonly storage: JsonDBService,
  ) {}

  @Handler()
  async onComplimentCommand(
    @InteractionEvent(SlashCommandPipe) { model }: CommandOptions,
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    const adminId = await this.configService.get('ADMIN');
    if (interaction.user.id !== adminId) {
      interaction.reply('Permission denied!');
      return;
    }
    if (model !== 3 && model !== 4) {
      interaction.reply('Invalid model');
      return;
    }
    await this.storage.setModelVersion(model as 3 | 4);
    interaction.reply(`Set model to: ${model}`);
  }
}
