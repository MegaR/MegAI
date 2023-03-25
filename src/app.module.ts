import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { Client, GatewayIntentBits, Message } from 'discord.js';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config/dist';
import { JsonDBService } from './jsondb.service';
import { SetPersonalityCommand } from './commands/chatcommands/setpersonality.command';
import { DiscordGateway } from './discord.gateway';
import { ChatGPTService } from './chatgpt.service';
import { StoryCommand } from './commands/chatcommands/story.command';
import { ComplimentCommand } from './commands/chatcommands/compliment.command';
import { EightballCommand } from './commands/chatcommands/eightball.command';
import { SummarizerCommand } from './commands/chatcommands/summarizer.command';
import { RoastCommand } from './commands/chatcommands/roast.command';
import { DefendCommand } from './commands/chatcommands/defend.command';
import { SwitchCommand } from './commands/replycommands/switch.command';
import { BasedCommand } from './commands/replycommands/based.command';
import { ComebackCommand } from './commands/replycommands/comeback.command';
import { UwuCommand } from './commands/replycommands/accents/uwu.command';
import { RedneckCommand } from './commands/replycommands/accents/redneck.command';
import { ReplyCommand } from './commands/replycommands/reply.command';
import { ModelCommand } from './commands/chatcommands/model.command';
import { JoinCommand } from './commands/chatcommands/join.command';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DiscordModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        token: configService.getOrThrow('DISCORD_TOKEN'),
        discordClientOptions: {
          intents: [
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.Guilds,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.GuildVoiceStates,
          ],
        },
        registerCommandOptions: [
          {
            allowFactory: (message: Message) =>
              !message.author.bot && message.content === '!update',
          },
        ],
      }),
      setupClientFactory: (client: Client) => {
        client.setMaxListeners(30);
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [
    JsonDBService,
    ChatGPTService,
    DiscordGateway,
    ModelCommand,
    SetPersonalityCommand,
    StoryCommand,
    ComplimentCommand,
    EightballCommand,
    SummarizerCommand,
    RoastCommand,
    DefendCommand,
    SwitchCommand,
    ReplyCommand,
    BasedCommand,
    ComebackCommand,
    UwuCommand,
    JoinCommand,
    // RedneckCommand,
  ],
})
export class AppModule {}
