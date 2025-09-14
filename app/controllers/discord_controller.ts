import type { ChatInputCommandInteraction, Message } from "discord.js";
import logger from "@adonisjs/core/services/logger";
import env from "#start/env";
import OpenAIService from "#services/openai_service";
import ChatMessage from "#models/chat_message";
import type OpenAI from "openai";

export default class DiscordController {
  constructor(private openaiService: OpenAIService) {}

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
    if (message.author.bot) return;

    // Simple ping command
    if (message.content === "!ping") {
      await message.reply("Pong!");
      return;
    }

    // AI response when bot is mentioned
    if (message.mentions.has(botUserId)) {
      // Remove only the bot mention from the message content
      const prompt = message.content
        .replace(new RegExp(`<@!?${botUserId}>`, "g"), "") // Remove only bot mentions
        .trim();

      // Only respond if there's actual content after removing the mention
      if (prompt.length > 0) {
        await this.handleAIResponse(message, prompt);
      }
    }
  }

  private async handleAIResponse(message: Message, prompt: string) {
    try {
      if ("sendTyping" in message.channel) {
        await message.channel.sendTyping();
      }

      // Store the user's message
      await ChatMessage.storeUserMessage(
        message.channel.id,
        message.author.id,
        message.author.username,
        prompt,
        message.id,
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

      const response =
        await this.openaiService.createChatCompletion(conversationHistory);

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
      await message.reply(
        "Sorry, I encountered an error while processing your request.",
      );
    }
  }
}
