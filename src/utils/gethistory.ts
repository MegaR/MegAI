import { Message } from 'discord.js';
import { ChatCompletionRequestMessage } from 'openai';

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

  const role = message.author.id === botId ? 'assistant' : 'user';
  const text = message.cleanContent
    .replace('@' + client.user.username, '')
    .trim();
  history = [
    ...history,
    { role, content: text, name: message.author.username },
  ];
  //trim history
  while (history.length > 10) {
    history.splice(0, 1);
  }
  return history;
}
