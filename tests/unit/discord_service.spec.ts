import DiscordService from "#services/discord_service";
import ChatMessage from "#models/chat_message";
import { test } from "@japa/runner";

test.group("Discord Service", (group) => {
  const services: DiscordService[] = [];

  group.each.setup(async () => {
    await ChatMessage.query().delete();
  });

  group.each.teardown(async () => {
    await ChatMessage.query().delete();
    // Clean up any Discord services to prevent hanging
    for (const service of services) {
      await service.stop();
    }
    services.length = 0;
  });

  test("should create Discord client with correct intents", ({ assert }) => {
    const service = new DiscordService();
    services.push(service);
    const client = service.getClient();

    assert.isTrue(client.options.intents.has("Guilds"));
    assert.isTrue(client.options.intents.has("GuildMessages"));
    assert.isTrue(client.options.intents.has("DirectMessages"));
    assert.isTrue(client.options.intents.has("MessageContent"));
  });

  test("should not be ready initially", ({ assert }) => {
    const service = new DiscordService();
    services.push(service);
    assert.isFalse(service.isClientReady());
  });

  test("clearChannelHistory integration test", async ({ assert }) => {
    // This test validates that the ChatMessage.clearChannelHistory method
    // works correctly, which is the core functionality used by the /clear command

    // Create some test messages in different channels
    await ChatMessage.storeUserMessage(
      "test_channel_123",
      "user1",
      "testuser",
      "Test message 1",
    );
    await ChatMessage.storeAssistantMessage(
      "test_channel_123",
      "Test response 1",
    );
    await ChatMessage.storeUserMessage(
      "test_channel_456",
      "user2",
      "testuser2",
      "Message in different channel",
    );

    // Verify messages exist
    const channel123Messages = await ChatMessage.getRecentMessages(
      "test_channel_123",
      10,
    );
    const channel456Messages = await ChatMessage.getRecentMessages(
      "test_channel_456",
      10,
    );
    assert.equal(channel123Messages.length, 2);
    assert.equal(channel456Messages.length, 1);

    // Clear channel 123 - this simulates what the /clear command does
    const deletedCount =
      await ChatMessage.clearChannelHistory("test_channel_123");
    assert.equal(deletedCount, 2);

    // Verify channel 123 is cleared but 456 is untouched
    const afterClear123 = await ChatMessage.getRecentMessages(
      "test_channel_123",
      10,
    );
    const afterClear456 = await ChatMessage.getRecentMessages(
      "test_channel_456",
      10,
    );

    assert.equal(afterClear123.length, 0);
    assert.equal(afterClear456.length, 1);
    assert.equal(afterClear456[0].content, "Message in different channel");
  });
});
