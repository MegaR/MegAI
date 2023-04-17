import { Message } from 'discord.js';
import {
  ChatCompletionRequestMessage,
  ChatCompletionRequestMessageRoleEnum,
} from 'openai';

const nameRegex = /^!(\S*)/;

interface GetHistoryOptions {
  botId?: string;
}

export async function getHistory(
  message: Message,
  options?: GetHistoryOptions,
): Promise<ChatCompletionRequestMessage[]> {
  const client = message.client;
  let history: ChatCompletionRequestMessage[] = [];
  if (message.reference) {
    const parent = await message.fetchReference();
    history = await getHistory(parent, options);
  }

  let botId = client.user.id;
  if (options?.botId) {
    botId = options.botId;
  }

  let role: ChatCompletionRequestMessageRoleEnum =
    message.author.id === botId
      ? ChatCompletionRequestMessageRoleEnum.Assistant
      : ChatCompletionRequestMessageRoleEnum.User;

  let content = message.cleanContent
    .replace('@' + client.user.username, '')
    .trim();
  let name = message.author.username;

  if (nameRegex.exec(content)) {
    name = nameRegex.exec(content)[1];
    if (name === client.user.username) {
      role = ChatCompletionRequestMessageRoleEnum.Assistant;
    }
    if (name === 'system') {
      role = ChatCompletionRequestMessageRoleEnum.System;
    }
    content = content.replace(nameRegex, '').trim();
  }

  history = [...history, { role, name, content }];
  //trim history
  while (history.length > 10) {
    history.splice(0, 1);
  }
  return history;
}
