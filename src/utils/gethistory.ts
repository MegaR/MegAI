import { Client, Message } from 'discord.js';

interface GetHistoryOptions {
  prependUsername?: boolean;
  botId?: string;
}

export async function getHistory(
  message: Message,
  options?: GetHistoryOptions,
) {
  const client = message.client;
  let history = [];
  if (message.reference) {
    const parent = await message.fetchReference();
    history = await getHistory(parent, options);
  }

  let botId = client.user.id;
  if (options?.botId) {
    botId = options.botId;
  }

  const role = message.author.id === botId ? 'assistant' : 'user';
  let text = message.cleanContent
    .replace('@' + client.user.username, '')
    .trim();
  if (options?.prependUsername) {
    text = `${message.author.username}: ${text}`;
  }
  history = [...history, { role, content: text }];
  return history;
}
