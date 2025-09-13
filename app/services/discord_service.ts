import { Client, GatewayIntentBits, Events, Message } from "discord.js";
import logger from "@adonisjs/core/services/logger";
import env from "#start/env";
import OpenAIService from "#services/openai_service";

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

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, (readyClient) => {
      this.isReady = true;
      logger.info(`Discord bot ready! Logged in as ${readyClient.user.tag}`);
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

            const response = await this.openaiService.createChatCompletion([
              {
                role: "user",
                content: prompt,
              },
            ]);

            const aiResponse = response.choices[0]?.message?.content;
            if (aiResponse) {
              await message.reply(aiResponse);
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
