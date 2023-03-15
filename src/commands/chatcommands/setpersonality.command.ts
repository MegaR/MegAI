import { SlashCommandPipe } from '@discord-nestjs/common';
import {
  Command,
  Handler,
  InteractionEvent,
  Param,
} from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { CommandInteraction, PermissionFlagsBits } from 'discord.js';
import { JsonDBService } from 'src/jsondb.service';

class SetPersonalityOptions {
  @Param({ description: 'Prompt', required: true })
  prompt: string;
}

@Command({
  name: 'set-personality',
  description: 'Set the system prompt',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class SetPersonalityCommand {
  constructor(private readonly storage: JsonDBService) {}

  @Handler()
  async onSetSystemPrompt(
    @InteractionEvent(SlashCommandPipe) options: SetPersonalityOptions,
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    const systemPrompt = options.prompt.trim().replace(/\.+$/, '');
    await this.storage.setPersonality(
      interaction.guild.id,
      interaction.guild.name,
      interaction.user.id,
      interaction.user.username,
      systemPrompt,
    );
    await interaction.reply({
      content: `Set system prompt to: ${systemPrompt}`,
      ephemeral: false,
    });
  }
}
