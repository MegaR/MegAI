import { Channel } from 'discord.js';

export async function sendTyping(channel: Channel) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  await channel.sendTyping();
}
