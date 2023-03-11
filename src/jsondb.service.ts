import { Injectable } from '@nestjs/common';
import { Config, JsonDB } from 'node-json-db';

@Injectable()
export class JsonDBService {
  private db: JsonDB;

  constructor() {
    this.db = new JsonDB(new Config('jsonDB', true, true, undefined, true));
  }

  public async setPersonality(
    guildId: string,
    guildName: string,
    userId: string,
    username: string,
    prompt: string,
  ) {
    await this.db.push(
      `/guild/${guildId}`,
      {
        name: guildName,
      },
      false,
    );
    await this.db.push(`/guild/${guildId}/user/${userId}`, {
      name: username,
      systemPrompt: prompt,
    });
  }

  public async getPersonality(guildId: string, userId: string) {
    return await this.db.getData(
      `/guild/${guildId}/user/${userId}/systemPrompt`,
    );
  }
}
