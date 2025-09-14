import { DateTime } from "luxon";
import { BaseModel, column } from "@adonisjs/lucid/orm";
import type { ImageData } from "#services/image_service";

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

  @column({
    serializeAs: null,
    prepare: (value) => (value ? JSON.stringify(value) : null),
    consume: (value) => (value ? JSON.parse(value) : null),
  })
  declare images: ImageData[] | null;

  @column()
  declare hasImages: boolean;

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
    images?: ImageData[],
  ) {
    return await ChatMessage.create({
      channelId,
      userId,
      username,
      content,
      role: "user",
      messageId,
      images,
      hasImages: Boolean(images && images.length > 0),
    });
  }

  static async storeAssistantMessage(
    channelId: string,
    content: string,
    messageId?: string,
    images?: ImageData[],
  ) {
    return await ChatMessage.create({
      channelId,
      userId: "assistant",
      username: "MegAI",
      content,
      role: "assistant",
      messageId,
      images,
      hasImages: Boolean(images && images.length > 0),
    });
  }

  static async clearChannelHistory(channelId: string) {
    return await ChatMessage.query().where("channel_id", channelId).delete();
  }
}
