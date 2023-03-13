import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { GatewayIntentBits, Message } from 'discord.js';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config/dist';
import { JsonDBService } from './jsondb.service';
import { SetPersonalityCommand } from './commands/setpersonality.command';
import { DiscordGateway } from './discord.gateway';
import { ChatGPTService } from './chatgpt.service';
import { StoryCommand } from './commands/story.command';
import { ComplimentCommand } from './commands/compliment.command';
import { EightballCommand } from './commands/eightball.command';
import { SummarizerCommand } from './commands/summarizer.command';
import { ComebackCommand } from './commands/comeback.command';
import { RoastCommand } from './commands/roast.command';
import { DefendCommand } from './commands/defend.command';

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
          ],
        },
        registerCommandOptions: [
          {
            allowFactory: (message: Message) =>
              !message.author.bot && message.content === '!update',
          },
        ],
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [],
  providers: [
    JsonDBService,
    ChatGPTService,
    DiscordGateway,
    SetPersonalityCommand,
    StoryCommand,
    ComplimentCommand,
    EightballCommand,
    SummarizerCommand,
    ComebackCommand,
    RoastCommand,
    DefendCommand,
  ],
})
export class AppModule {}
