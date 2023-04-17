import { Message } from 'discord.js';

export class UpdatingReply {
  private reply: Message;
  private progress = '';
  private interval: any;

  constructor(private readonly parent: Message) {}

  async start() {
    this.reply = await this.parent.reply('⌛');
    this.interval = setInterval(async () => {
      if (this.reply.cleanContent !== this.progress && this.progress) {
        this.reply = await this.reply.edit(this.progress + '⌛');
      }
    }, 1000);
    return this.reply;
  }

  update(token: string) {
    this.progress += token;
  }

  async stop(result?: string) {
    clearInterval(this.interval);
    if (result) {
      this.reply = await this.reply.edit(`${result}`);
    } else {
      this.reply = await this.reply.edit(`${this.progress} ❌`);
    }
  }
}
