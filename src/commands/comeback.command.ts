import { Command, Handler } from '@discord-nestjs/core';
import { Injectable } from '@nestjs/common';
import { PermissionFlagsBits } from 'discord.js';

@Command({
  name: 'comeback',
  description: 'Generates a clever comeback. Use wisely',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class ComebackCommand {
  @Handler()
  async onSummarizeCommand() {
    return 'No u';
  }
}
