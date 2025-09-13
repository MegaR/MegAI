import { test } from "@japa/runner";
import ChatMessage from "#models/chat_message";

test.group("ChatMessage Model", (group) => {
  group.each.setup(async () => {
    await ChatMessage.query().delete();
  });

  group.each.teardown(async () => {
    await ChatMessage.query().delete();
  });

  test("should store user message correctly", async ({ assert }) => {
    const message = await ChatMessage.storeUserMessage(
      "channel123",
      "user456",
      "testuser",
      "Hello world!",
      "msg789",
    );

    assert.equal(message.channelId, "channel123");
    assert.equal(message.userId, "user456");
    assert.equal(message.username, "testuser");
    assert.equal(message.content, "Hello world!");
    assert.equal(message.role, "user");
    assert.equal(message.messageId, "msg789");
  });

  test("should store assistant message correctly", async ({ assert }) => {
    const message = await ChatMessage.storeAssistantMessage(
      "channel123",
      "Hello! How can I help you?",
      "reply456",
    );

    assert.equal(message.channelId, "channel123");
    assert.equal(message.userId, "assistant");
    assert.equal(message.username, "MegAI");
    assert.equal(message.content, "Hello! How can I help you?");
    assert.equal(message.role, "assistant");
    assert.equal(message.messageId, "reply456");
  });

  test("should retrieve recent messages correctly", async ({ assert }) => {
    // Store some messages
    await ChatMessage.storeUserMessage(
      "channel123",
      "user1",
      "user1",
      "Message 1",
    );
    await ChatMessage.storeAssistantMessage("channel123", "Response 1");
    await ChatMessage.storeUserMessage(
      "channel123",
      "user1",
      "user1",
      "Message 2",
    );
    await ChatMessage.storeAssistantMessage("channel123", "Response 2");

    // Store messages in different channel
    await ChatMessage.storeUserMessage(
      "channel456",
      "user1",
      "user1",
      "Other channel message",
    );

    const messages = await ChatMessage.getRecentMessages("channel123", 10);

    assert.equal(messages.length, 4); // Should get all 4 messages from channel123
    assert.isTrue(messages.some((m) => m.content === "Message 1"));
    assert.isTrue(messages.some((m) => m.content === "Response 1"));
    assert.isTrue(messages.some((m) => m.content === "Message 2"));
    assert.isTrue(messages.some((m) => m.content === "Response 2"));
  });
});
