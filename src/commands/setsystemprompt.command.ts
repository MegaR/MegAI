import { SlashCommandPipe } from '@discord-nestjs/common';
import {
  Command,
  Handler,
  InteractionEvent,
  Param,
} from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { CommandInteraction } from 'discord.js';
import { JsonDBService } from 'src/jsondb.factory';

class SetSystemPromptOptions {
  @Param({ description: 'Prompt', required: true })
  prompt: string;
}

@Command({
  name: 'set-system-prompt',
  description: 'Set the system prompt',
})
@Injectable()
export class SetSystemPromptCommand {
  constructor(private readonly storage: JsonDBService) {}

  @Handler()
  async onSetSystemPrompt(
    @InteractionEvent(SlashCommandPipe) options: SetSystemPromptOptions,
    @InteractionEvent() interaction: CommandInteraction,
  ): Promise<string> {
    const systemPrompt = options.prompt.trim().replace(/\.+$/, '');
    await this.storage.push(`/guild/${interaction.guild.id}`, {
      name: interaction.guild.name,
    });
    await this.storage.push(
      `/guild/${interaction.guild.id}/channel/${interaction.channel.id}`,
      { name: interaction.channel.name },
    );
    await this.storage.push(
      `/guild/${interaction.guild.id}/channel/${interaction.channel.id}/user/${interaction.user.id}`,
      { name: interaction.user.username, systemPrompt },
    );
    return `Set system prompt to: ${systemPrompt}`;
  }
}
