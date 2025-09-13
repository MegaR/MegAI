import { BaseSchema } from "@adonisjs/lucid/schema";

export default class extends BaseSchema {
  protected tableName = "chat_messages";

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments("id");
      table.string("channel_id").notNullable().index();
      table.string("user_id").notNullable();
      table.string("username").notNullable();
      table.text("content").notNullable();
      table.enum("role", ["user", "assistant"]).notNullable();
      table.string("message_id").nullable(); // Discord message ID

      table.timestamp("created_at").notNullable();
      table.timestamp("updated_at").notNullable();
    });
  }

  async down() {
    this.schema.dropTable(this.tableName);
  }
}
