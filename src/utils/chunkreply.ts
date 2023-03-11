import { Message } from 'discord.js';

export async function chunkReply(message: Message, text: string) {
  const chunks = chunkString(text, 2000);
  for (const chunk of chunks) {
    await message.reply(chunk);
  }
}

function chunkString(str, chunkLength) {
  const chunks = [];
  for (let i = 0; i < str.length; i += chunkLength) {
    chunks.push(str.slice(i, i + chunkLength));
  }
  return chunks;
}
