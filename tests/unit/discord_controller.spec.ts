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
      channel: { type: 0 }, // Guild channel
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
      channel: { type: 0 }, // Guild channel
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

  test("should handle DM messages", async ({ assert }) => {
    const mockMessage = {
      author: { bot: false, id: "user1", username: "testuser" },
      id: "msg_123",
      content: "Hello bot, how are you?",
      channel: {
        type: 1, // DM channel
        id: "dm_channel_456", // Use unique channel ID
        sendTyping: async () => {},
      },
      mentions: { has: () => false }, // No mentions in DM
      reply: async (response: string) => {
        // Verify we get a response (OpenAI will be mocked)
        assert.isString(response);
        return { id: "reply_msg_123" }; // Mock reply message object
      },
    } as any;

    // Mock OpenAI service to return a test response
    const mockOpenAI = {
      createChatCompletion: async () => ({
        choices: [
          {
            message: { content: "Hello! I'm doing great, thanks for asking!" },
          },
        ],
      }),
    } as any;

    const controller = new DiscordController(mockOpenAI);

    await controller.handleMessage(mockMessage, "bot_user_id");

    // Verify the user message was processed (should trigger AI response)
    const messages = await ChatMessage.getRecentMessages("dm_channel_456", 10);
    assert.isAbove(messages.length, 0); // Should have at least the user message

    // Find the user message
    const userMessage = messages.find((m) => m.role === "user");
    assert.isDefined(userMessage);
    assert.equal(userMessage!.content, "Hello bot, how are you?");

    // Find the assistant message
    const assistantMessage = messages.find((m) => m.role === "assistant");
    assert.isDefined(assistantMessage);
    assert.equal(
      assistantMessage!.content,
      "Hello! I'm doing great, thanks for asking!",
    );
  });

  test("should handle ping in DM", async ({ assert }) => {
    const mockMessage = {
      author: { bot: false },
      content: "!ping",
      channel: { type: 1 }, // DM channel
      reply: async (response: string) => {
        assert.equal(response, "Pong!");
      },
      mentions: { has: () => false },
    } as any;

    const openaiService = new OpenAIService("test-api-key");
    const controller = new DiscordController(openaiService);

    await controller.handleMessage(mockMessage, "bot_user_id");
  });

  test("should handle mention in guild channel", async ({ assert }) => {
    const mockMessage = {
      author: { bot: false, id: "user1", username: "testuser" },
      id: "msg_123",
      content: "<@bot_user_id> Hello bot!",
      channel: {
        type: 0, // Guild channel
        id: "guild_channel_789", // Unique channel ID
        sendTyping: async () => {},
      },
      mentions: { has: (userId: string) => userId === "bot_user_id" },
      reply: async (response: string) => {
        assert.isString(response);
        return { id: "reply_msg_456" }; // Mock reply message object
      },
    } as any;

    // Mock OpenAI service
    const mockOpenAI = {
      createChatCompletion: async () => ({
        choices: [{ message: { content: "Hello there!" } }],
      }),
    } as any;

    const controller = new DiscordController(mockOpenAI);

    await controller.handleMessage(mockMessage, "bot_user_id");

    // Verify the message was stored with mention removed
    const messages = await ChatMessage.getRecentMessages(
      "guild_channel_789",
      10,
    );
    assert.isAbove(messages.length, 0);

    // Find the user message and verify mention was removed
    const userMessage = messages.find((m) => m.role === "user");
    assert.isDefined(userMessage);
    assert.equal(userMessage!.content, "Hello bot!"); // Mention should be removed
  });

  test("should ignore non-mention messages in guild channels", async ({
    assert,
  }) => {
    const mockMessage = {
      author: { bot: false },
      content: "Just a regular message",
      channel: { type: 0 }, // Guild channel
      mentions: { has: () => false }, // No mention
      reply: async () => {
        assert.fail("Should not reply to non-mention guild messages");
      },
    } as any;

    const openaiService = new OpenAIService("test-api-key");
    const controller = new DiscordController(openaiService);

    await controller.handleMessage(mockMessage, "bot_user_id");

    // If we get here without the assert.fail being called, the test passes
    assert.isTrue(true);
  });
});
