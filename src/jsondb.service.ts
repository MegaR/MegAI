import { Injectable } from '@nestjs/common';
import { Config, JsonDB } from 'node-json-db';

@Injectable()
export class JsonDBService {
  private db: JsonDB;

  constructor() {
    this.db = new JsonDB(new Config('jsonDB', true, true));
  }
  public async push(dataPath: string, data: any, override?: boolean) {
    return await this.db.push(dataPath, data, override);
  }

  public async getData(dataPath: string) {
    return await this.db.getData(dataPath);
  }
}
