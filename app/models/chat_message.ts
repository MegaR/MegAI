import { DateTime } from "luxon";
import { BaseModel, column } from "@adonisjs/lucid/orm";

export default class ChatMessage extends BaseModel {
  @column({ isPrimary: true })
  declare id: number;

  @column()
  declare channelId: string;

  @column()
  declare userId: string;

  @column()
  declare username: string;

  @column()
  declare content: string;

  @column()
  declare role: "user" | "assistant";

  @column()
  declare messageId: string | null;

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime;

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime;

  static async getRecentMessages(channelId: string, limit: number = 10) {
    return await ChatMessage.query()
      .where("channel_id", channelId)
      .orderBy("created_at", "desc")
      .limit(limit);
  }

  static async storeUserMessage(
    channelId: string,
    userId: string,
    username: string,
    content: string,
    messageId?: string,
  ) {
    return await ChatMessage.create({
      channelId,
      userId,
      username,
      content,
      role: "user",
      messageId,
    });
  }

  static async storeAssistantMessage(
    channelId: string,
    content: string,
    messageId?: string,
  ) {
    return await ChatMessage.create({
      channelId,
      userId: "assistant",
      username: "MegAI",
      content,
      role: "assistant",
      messageId,
    });
  }

  static async clearChannelHistory(channelId: string) {
    return await ChatMessage.query().where("channel_id", channelId).delete();
  }
}
