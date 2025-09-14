import {
  Client,
  GatewayIntentBits,
  Events,
  Message,
  SlashCommandBuilder,
  REST,
  Routes,
} from "discord.js";
import logger from "@adonisjs/core/services/logger";
import env from "#start/env";
import OpenAIService from "#services/openai_service";
import ChatMessage from "#models/chat_message";
import type OpenAI from "openai";

export default class DiscordService {
  private client: Client;
  private isReady = false;

  constructor(private openaiService: OpenAIService) {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    this.setupEventHandlers();
  }

  private async registerSlashCommands() {
    const commands = [
      new SlashCommandBuilder()
        .setName("clear")
        .setDescription("Clear the chat history for this channel"),
    ];

    const rest = new REST({ version: "10" }).setToken(
      env.get("DISCORD_BOT_TOKEN"),
    );

    try {
      const clientId = this.client.user?.id;
      if (!clientId) {
        throw new Error("Client ID not available");
      }

      logger.info("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationCommands(clientId), {
        body: commands.map((command) => command.toJSON()),
      });

      logger.info("Successfully reloaded application (/) commands.");
    } catch (error) {
      logger.error("Error registering slash commands:", error);
    }
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, async (readyClient) => {
      this.isReady = true;
      logger.info(`Discord bot ready! Logged in as ${readyClient.user.tag}`);

      // Register slash commands
      await this.registerSlashCommands();
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      if (interaction.commandName === "clear") {
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
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return;

      // Simple ping command
      if (message.content === "!ping") {
        await message.reply("Pong!");
      }

      // AI response when bot is mentioned
      if (message.mentions.has(this.client.user!)) {
        // Remove only the bot mention from the message content
        const botId = this.client.user!.id;
        const prompt = message.content
          .replace(new RegExp(`<@!?${botId}>`, "g"), "") // Remove only bot mentions
          .trim();

        // Only respond if there's actual content after removing the mention
        if (prompt.length > 0) {
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
              await this.openaiService.createChatCompletion(
                conversationHistory,
              );

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
    });

    this.client.on(Events.Error, (error) => {
      logger.error("Discord client error:", error);
    });
  }

  async start() {
    try {
      await this.client.login(env.get("DISCORD_BOT_TOKEN"));
      logger.info("Discord bot login initiated");
    } catch (error) {
      logger.error("Failed to start Discord bot:", error);
      throw error;
    }
  }

  async stop() {
    if (this.client) {
      this.client.destroy();
      this.isReady = false;
      logger.info("Discord bot stopped");
    }
  }

  getClient() {
    return this.client;
  }

  isClientReady() {
    return this.isReady;
  }
}
