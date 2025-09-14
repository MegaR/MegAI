import DiscordController from "#controllers/discord_controller";
import OpenAIService from "#services/openai_service";
import ChatMessage from "#models/chat_message";
import { test } from "@japa/runner";

test.group("Discord Controller", (group) => {
  group.each.setup(async () => {
    await ChatMessage.query().delete();
  });

  group.each.teardown(async () => {
    await ChatMessage.query().delete();
  });

  test("should handle clear command interaction", async ({ assert }) => {
    // This test validates that the controller properly delegates to the ChatMessage model

    // Create some test messages
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

    // Verify messages exist
    const beforeClear = await ChatMessage.getRecentMessages(
      "test_channel_123",
      10,
    );
    assert.equal(beforeClear.length, 2);

    // Create mock interaction
    const mockInteraction = {
      commandName: "clear",
      channel: { id: "test_channel_123" },
      deferReply: async () => {},
      editReply: async (message: string) => {
        // Verify the success message format
        assert.include(message, "✅ Cleared chat history");
        assert.include(message, "2 messages removed");
      },
      deferred: true,
    } as any;

    const openaiService = new OpenAIService("test-api-key");
    const controller = new DiscordController(openaiService);

    // Handle the slash command
    await controller.handleSlashCommand(mockInteraction);

    // Verify messages were cleared
    const afterClear = await ChatMessage.getRecentMessages(
      "test_channel_123",
      10,
    );
    assert.equal(afterClear.length, 0);
  });

  test("should handle ping message", async ({ assert }) => {
    const mockMessage = {
      author: { bot: false },
      content: "!ping",
      reply: async (response: string) => {
        assert.equal(response, "Pong!");
      },
      mentions: { has: () => false },
    } as any;

    const openaiService = new OpenAIService("test-api-key");
    const controller = new DiscordController(openaiService);

    await controller.handleMessage(mockMessage, "bot_user_id");
  });

  test("should ignore bot messages", async ({ assert }) => {
    const mockMessage = {
      author: { bot: true },
      content: "!ping",
      reply: async () => {
        // This should never be called
        assert.fail("Should not reply to bot messages");
      },
    } as any;

    const openaiService = new OpenAIService("test-api-key");
    const controller = new DiscordController(openaiService);

    // This should return early and not call reply
    await controller.handleMessage(mockMessage, "bot_user_id");

    // If we get here without the assert.fail being called, the test passes
    assert.isTrue(true);
  });
});
