import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { GatewayIntentBits, Message } from 'discord.js';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config/dist';
import { JsonDBService } from './jsondb.service';
import { SetSystemPromptCommand } from './commands/setsystemprompt.command';
import { DiscordGateway } from './discord.gateway';
import { ChatGPTService } from './chatgpt.service';

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
    SetSystemPromptCommand,
  ],
})
export class AppModule {}
