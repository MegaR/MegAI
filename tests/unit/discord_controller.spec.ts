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
      attachments: new Map(), // No attachments
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
      attachments: new Map(), // No attachments
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
      attachments: new Map(), // Empty attachments
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
      attachments: new Map(), // No attachments
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
      attachments: new Map(), // Empty attachments
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
      attachments: new Map(), // No attachments
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

  test("should handle message with image attachment", async ({ assert }) => {
    // Mock image attachment
    const mockAttachment = {
      url: "https://cdn.discordapp.com/attachments/123/456/image.jpg",
      contentType: "image/jpeg",
      name: "image.jpg",
      size: 1024,
    };

    const mockAttachments = new Map([["123", mockAttachment]]);

    const mockMessage = {
      author: { bot: false, id: "user1", username: "testuser" },
      id: "msg_123",
      content: "What's in this image?",
      channel: {
        type: 1, // DM channel
        id: "dm_channel_images",
        sendTyping: async () => {},
      },
      mentions: { has: () => false },
      attachments: mockAttachments,
      reply: async (response: string) => {
        assert.isString(response);
        return { id: "reply_msg_123" };
      },
    } as any;

    // Mock OpenAI service to simulate vision response
    const mockOpenAI = {
      createChatCompletionWithImages: async (
        text: string,
        images: string[],
        _conversationHistory: any[],
      ) => {
        assert.equal(text, "What's in this image?");
        assert.equal(images.length, 1);
        assert.equal(
          images[0],
          "https://cdn.discordapp.com/attachments/123/456/image.jpg",
        );
        return {
          choices: [
            {
              message: {
                content: "I can see a beautiful landscape in the image!",
              },
            },
          ],
        };
      },
      createChatCompletion: async () => {
        assert.fail("Should use vision method for images");
        return { choices: [{ message: { content: "" } }] };
      },
    } as any;

    // Mock ImageService
    const mockImageService = {
      downloadMultipleImages: async (images: any[]) => {
        return images.map((img) => ({
          filename: img.filename || "image.jpg",
          contentType: "image/jpeg",
          size: 1024,
          data: "base64encodeddata",
          originalUrl: img.url,
        }));
      },
    } as any;

    const controller = new DiscordController(mockOpenAI, mockImageService);

    await controller.handleMessage(mockMessage, "bot_user_id");

    // Verify the message was stored with image indicator
    const messages = await ChatMessage.getRecentMessages(
      "dm_channel_images",
      10,
    );
    assert.equal(messages.length, 2); // User message + AI response

    // Find the user and AI messages
    const userMessage = messages.find((m) => m.role === "user");
    const aiMessage = messages.find((m) => m.role === "assistant");

    assert.isDefined(userMessage);
    assert.isDefined(aiMessage);
    assert.include(userMessage!.content, "[Images: 1]"); // User message with image indicator
    assert.include(aiMessage!.content, "I can see a beautiful landscape"); // AI response
  });

  test("should handle text-only message with image attachments", async ({
    assert,
  }) => {
    // Mock image attachment with no text content
    const mockAttachment = {
      url: "https://example.com/image.png",
      contentType: "image/png",
      name: "image.png",
      size: 2048,
    };

    const mockAttachments = new Map([["456", mockAttachment]]);

    const mockMessage = {
      author: { bot: false, id: "user2", username: "imageuser" },
      id: "msg_456",
      content: "", // No text, just image
      channel: {
        type: 1, // DM channel
        id: "dm_channel_imageonly",
        sendTyping: async () => {},
      },
      mentions: { has: () => false },
      attachments: mockAttachments,
      reply: async (response: string) => {
        assert.isString(response);
        return { id: "reply_msg_456" };
      },
    } as any;

    // Mock OpenAI service
    const mockOpenAI = {
      createChatCompletionWithImages: async (
        text: string,
        images: string[],
        _conversationHistory: any[],
      ) => {
        assert.equal(text, ""); // Should be empty text
        assert.equal(images.length, 1);
        return {
          choices: [{ message: { content: "I can analyze this image!" } }],
        };
      },
      createChatCompletion: async () => {
        assert.fail("Should use vision method for images");
        return { choices: [{ message: { content: "" } }] };
      },
    } as any;

    // Mock ImageService
    const mockImageService = {
      downloadMultipleImages: async (images: any[]) => {
        return images.map((img) => ({
          filename: img.filename || "image.png",
          contentType: "image/png",
          size: 2048,
          data: "base64encodeddata",
          originalUrl: img.url,
        }));
      },
    } as any;

    const controller = new DiscordController(mockOpenAI, mockImageService);

    await controller.handleMessage(mockMessage, "bot_user_id");

    // Verify the message was processed even with no text
    const messages = await ChatMessage.getRecentMessages(
      "dm_channel_imageonly",
      10,
    );
    assert.equal(messages.length, 2); // User message + AI response

    // Find the user and AI messages
    const userMessage = messages.find((m) => m.role === "user");
    const aiMessage = messages.find((m) => m.role === "assistant");

    assert.isDefined(userMessage);
    assert.isDefined(aiMessage);
    assert.include(userMessage!.content, "[Images: 1]"); // Should still have image indicator
  });
});
