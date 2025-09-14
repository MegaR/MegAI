import discordRouter from "#start/discord";
import ChatMessage from "#models/chat_message";
import { test } from "@japa/runner";

test.group("Discord Router", (group) => {
  group.each.setup(async () => {
    await ChatMessage.query().delete();
  });

  group.each.teardown(async () => {
    await ChatMessage.query().delete();
  });

  test("should register slash commands", ({ assert }) => {
    const registeredCommands = discordRouter.getRegisteredSlashCommands();
    assert.include(registeredCommands, "clear");
  });

  test("should handle clear slash command", async ({ assert }) => {
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

    // Handle the slash command through the router
    await discordRouter.handleSlashCommand(mockInteraction);

    // Verify messages were cleared
    const afterClear = await ChatMessage.getRecentMessages(
      "test_channel_123",
      10,
    );
    assert.equal(afterClear.length, 0);
  });

  test("should handle ping message through router", async ({ assert }) => {
    const mockMessage = {
      author: { bot: false },
      content: "!ping",
      channel: { type: 0 }, // Guild channel
      reply: async (response: string) => {
        assert.equal(response, "Pong!");
      },
      mentions: { has: () => false },
    } as any;

    await discordRouter.handleMessage(mockMessage, "bot_user_id");
  });

  test("should ignore bot messages through router", async ({ assert }) => {
    const mockMessage = {
      author: { bot: true },
      content: "!ping",
      channel: { type: 0 }, // Guild channel
      reply: async () => {
        // This should never be called
        assert.fail("Should not reply to bot messages");
      },
    } as any;

    // This should return early and not call reply
    await discordRouter.handleMessage(mockMessage, "bot_user_id");

    // If we get here without the assert.fail being called, the test passes
    assert.isTrue(true);
  });

  test("should handle ping in DM through router", async ({ assert }) => {
    const mockMessage = {
      author: { bot: false },
      content: "!ping",
      channel: {
        type: 1, // DM channel
      },
      mentions: { has: () => false },
      reply: async (response: string) => {
        assert.equal(response, "Pong!");
      },
    } as any;

    await discordRouter.handleMessage(mockMessage, "bot_user_id");
  });
});
