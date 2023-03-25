import {
  Command,
  Handler,
  InjectDiscordClient,
  InteractionEvent,
} from '@discord-nestjs/core';
import {
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  StreamType,
  VoiceConnection,
} from '@discordjs/voice';
import { Injectable, Logger } from '@nestjs/common';
import { addSpeechEvent } from 'discord-speech-recognition';
import {
  Client,
  CommandInteraction,
  Message,
  PermissionFlagsBits,
  VoiceBasedChannel,
} from 'discord.js';
import { ChatGPTService } from 'src/chatgpt.service';
import * as googleTTS from 'google-tts-api';
import { ChatCompletionRequestMessage } from 'openai';

@Command({
  name: 'join-channel',
  description: 'Make the bot join a voice channel',
  defaultMemberPermissions: PermissionFlagsBits.SendMessages,
})
@Injectable()
export class JoinCommand {
  private logger = new Logger(JoinCommand.name);
  private player = createAudioPlayer();
  private connection?: VoiceConnection;

  private history: ChatCompletionRequestMessage[] = [];
  private thinking = false;
  private systemPrompt =
    'Assistant is part of a voice call. Assistant will respond in English.';

  constructor(
    @InjectDiscordClient() private readonly client: Client,
    private readonly chatGPT: ChatGPTService,
  ) {
    addSpeechEvent(client);
    this.client.on('speech', (msg) => {
      this.onSpeech(msg);
    });
    // this.client.on('voiceStateUpdate', (oldMember, newMember) => {
    //   if(newMember) {
    //     this.history.
    //   }
    // });
  }

  @Handler()
  async onComplimentCommand(
    @InteractionEvent() interaction: CommandInteraction,
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const channel = interaction.member.voice.channel as VoiceBasedChannel;
    if (!channel) {
      await interaction.reply('You need to be in a voice channel to use this.');
      return;
    }

    try {
      await this.joinChannel(channel);
      interaction.reply({
        content: `Joined channel #${channel.name}`,
        ephemeral: true,
      });
    } catch (e) {
      this.logger.error(e);
      interaction.reply({
        content: `Failed to join channel #${channel.name}`,
        ephemeral: true,
      });
    }
  }

  async joinChannel(channel: VoiceBasedChannel) {
    this.leaveChannel();
    this.connection = joinVoiceChannel({
      guildId: channel.guildId,
      channelId: channel.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
    });
    this.connection.subscribe(this.player);
    this.history = [{ role: 'system', content: this.systemPrompt }];
    this.thinking = false;
  }

  leaveChannel() {
    this.connection?.disconnect();
  }

  async onSpeech(message: Message) {
    console.log('User: ', message.content);
    if (message.content === 'leave') {
      this.leaveChannel();
      return;
    }
    this.history.push({
      role: 'user',
      content: message.content,
      name: message.author.username,
    });
    if (this.thinking) {
      console.log('Bot is thinking, ignoring the message...');
      return;
    }
    try {
      this.thinking = true;
      const response = await this.chatGPT.complete(this.history);
      this.history.push({
        role: 'assistant',
        content: response,
        name: 'Assistant',
      });
      await this.say(response);
    } catch (e) {
      this.logger.error('Error during thinking process', e);
    } finally {
      this.thinking = false;
    }
  }

  async say(text: string) {
    console.log('Bot: ', text);
    const urls = googleTTS.getAllAudioUrls(text, {
      lang: 'en',
      slow: false,
      host: 'https://translate.google.com',
      splitPunct: ',.!?…',
    });
    for (const url of urls) {
      await this.playAudio(url.url);
    }
  }

  playAudio(url: string): Promise<void> {
    return new Promise((resolve) => {
      const resource = createAudioResource(url, {
        inputType: StreamType.Arbitrary,
      });

      const listener = (_oldState, newState) => {
        if (newState.status === 'idle') {
          console.log('Audio playback finished');
          this.player.removeListener('stateChange', listener);
          resolve();
        }
      };

      this.player.on('stateChange', listener);
      this.player.play(resource);
    });
  }
}
