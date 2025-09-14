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
import discordRouter from "#start/discord";

export default class DiscordService {
  private client: Client;
  private isReady = false;

  constructor() {
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
    const registeredCommands = discordRouter.getRegisteredSlashCommands();
    const commands = registeredCommands.map((commandName) => {
      switch (commandName) {
        case "clear":
          return new SlashCommandBuilder()
            .setName("clear")
            .setDescription("Clear the chat history for this channel");
        default:
          throw new Error(`Unknown command: ${commandName}`);
      }
    });

    if (commands.length === 0) {
      logger.info("No slash commands to register");
      return;
    }

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

      await discordRouter.handleSlashCommand(interaction);
    });

    this.client.on(Events.MessageCreate, async (message: Message) => {
      await discordRouter.handleMessage(message, this.client.user!.id);
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
