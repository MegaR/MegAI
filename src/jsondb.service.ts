import { Injectable } from '@nestjs/common';
import { Config, JsonDB } from 'node-json-db';

@Injectable()
export class JsonDBService {
  private db: JsonDB;

  constructor() {
    this.db = new JsonDB(new Config('jsonDB', true, true, undefined, true));
  }

  public async setModelVersion(model: '3' | '4' | 'llama') {
    await this.db.push(`/model`, model);
  }

  public async getModelVersion(): Promise<'3' | '4' | 'llama'> {
    const exists = await this.db.exists('/model');
    if (!exists) {
      return '3';
    }
    const model = (await this.db.getData(`/model`)) as '3' | '4' | 'llama';
    return model;
  }
}
