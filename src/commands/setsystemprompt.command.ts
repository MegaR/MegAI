import { SlashCommandPipe } from '@discord-nestjs/common';
import {
  Command,
  Handler,
  InteractionEvent,
  Param,
} from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
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
  ): Promise<string> {
    const systemPrompt = options.prompt.trim().replace(/\.+$/, '');
    await this.storage.push('/systemPrompt', systemPrompt);
    return `Set system prompt to: ${systemPrompt}`;
  }
}
