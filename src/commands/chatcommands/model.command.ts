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
  @Param({
    description: '3 or 4 or llama',
    required: true,
    type: ParamType.STRING,
  })
  model: string;
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
    if (model !== '3' && model !== '4' && model !== 'llama') {
      interaction.reply('Invalid model');
      return;
    }
    await this.storage.setModelVersion(model as '3' | '4' | 'llama');
    interaction.reply(`Set model to: ${model}`);
  }
}
