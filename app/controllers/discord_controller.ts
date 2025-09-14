import type { ChatInputCommandInteraction, Message } from "discord.js";
import { ChannelType } from "discord.js";
import logger from "@adonisjs/core/services/logger";
import env from "#start/env";
import OpenAIService from "#services/openai_service";
import ImageService, { type ImageData } from "#services/image_service";
import ChatMessage from "#models/chat_message";
import type OpenAI from "openai";

export default class DiscordController {
  constructor(
    private openaiService: OpenAIService,
    private imageService = new ImageService(),
  ) {}

  async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    if (interaction.commandName === "clear") {
      await this.handleClearCommand(interaction);
    }
  }

  private async handleClearCommand(interaction: ChatInputCommandInteraction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      const deletedCount = await ChatMessage.clearChannelHistory(
        interaction.channel!.id,
      );

      await interaction.editReply(
        `✅ Cleared chat history for this channel! (${deletedCount} messages removed)`,
      );
    } catch (error) {
      logger.error("Error clearing chat history:", error);

      if (interaction.deferred) {
        await interaction.editReply(
          "❌ Sorry, I encountered an error while clearing the chat history.",
        );
      } else {
        await interaction.reply({
          content:
            "❌ Sorry, I encountered an error while clearing the chat history.",
          ephemeral: true,
        });
      }
    }
  }

  async handleMessage(message: Message, botUserId: string) {
    if (message.author?.bot) return;

    // Simple ping command
    if (message.content === "!ping") {
      await message.reply("Pong!");
      return;
    }

    // Check if this is a DM or if bot is mentioned
    const isDM = message.channel.type === ChannelType.DM;
    const isBotMentioned = message.mentions.has(botUserId);

    if (isDM || isBotMentioned) {
      let prompt = message.content;

      // Remove bot mention if it's a guild message with mention
      if (isBotMentioned && !isDM) {
        prompt = message.content
          .replace(new RegExp(`<@!?${botUserId}>`, "g"), "") // Remove only bot mentions
          .trim();
      }

      // Extract image URLs from attachments
      const imageAttachments = message.attachments
        ? Array.from(message.attachments.values())
            .filter((attachment) =>
              attachment.contentType?.startsWith("image/"),
            )
            .map((attachment) => ({
              url: attachment.url,
              filename: attachment.name || undefined,
            }))
        : [];

      // Only respond if there's actual content or images
      if (prompt.length > 0 || imageAttachments.length > 0) {
        await this.handleAIResponse(message, prompt, imageAttachments);
      }
    }
  }

  private async handleAIResponse(
    message: Message,
    prompt: string,
    imageAttachments: Array<{
      url: string;
      filename?: string;
    }> = [],
  ) {
    try {
      if ("sendTyping" in message.channel) {
        await message.channel.sendTyping();
      }

      // Download images if any
      let downloadedImages: ImageData[] | undefined;
      if (imageAttachments.length > 0) {
        try {
          logger.info(`Downloading ${imageAttachments.length} images...`);
          downloadedImages =
            await this.imageService.downloadMultipleImages(imageAttachments);
          logger.info(
            `Successfully downloaded ${downloadedImages.length} images`,
          );
        } catch (error) {
          logger.error("Failed to download images:", error);
          // Continue without images rather than failing completely
          downloadedImages = undefined;
        }
      }

      // Store the user's message with images
      // Include image count in content for backward compatibility
      const userContent =
        imageAttachments.length > 0
          ? `${prompt} [Images: ${imageAttachments.length}]`
          : prompt;

      await ChatMessage.storeUserMessage(
        message.channel.id,
        message.author!.id,
        message.author!.username,
        userContent,
        message.id,
        downloadedImages,
      );

      // Get recent chat history for context
      const historyLimit = env.get("CHAT_HISTORY_LIMIT", 10);
      const recentMessages = await ChatMessage.getRecentMessages(
        message.channel.id,
        historyLimit,
      );

      // Build conversation context from recent messages (reverse to chronological order)
      const conversationHistory: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        recentMessages.reverse().map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

      const imageUrls = imageAttachments.map((img) => img.url);
      const response =
        imageAttachments.length > 0
          ? await this.openaiService.createChatCompletionWithImages(
              prompt,
              imageUrls,
              conversationHistory,
            )
          : await this.openaiService.createChatCompletion([
              ...conversationHistory,
              { role: "user", content: prompt },
            ]);

      const aiResponse = response.choices[0]?.message?.content;
      if (aiResponse) {
        const reply = await message.reply(aiResponse);

        // Store the assistant's response
        await ChatMessage.storeAssistantMessage(
          message.channel.id,
          aiResponse,
          reply.id,
        );
      } else {
        await message.reply("Sorry, I couldn't generate a response.");
      }
    } catch (error) {
      logger.error("OpenAI API error:", error);
      if (error instanceof Error) {
        logger.error("Error message:", error.message);
        logger.error("Error stack:", error.stack);
      }
      await message.reply(
        "Sorry, I encountered an error while processing your request.",
      );
    }
  }
}
