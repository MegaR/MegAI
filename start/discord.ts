/*
|--------------------------------------------------------------------------
| Discord Routes
|--------------------------------------------------------------------------
|
| This file defines Discord interaction handlers similar to HTTP routes.
| Slash commands and message handlers are registered here.
|
*/

import type { ChatInputCommandInteraction, Message } from "discord.js";
import app from "@adonisjs/core/services/app";

type SlashCommandHandler = (
  interaction: ChatInputCommandInteraction,
) => Promise<void>;
type MessageHandler = (message: Message, botUserId: string) => Promise<void>;

class DiscordRouter {
  private slashCommands = new Map<string, SlashCommandHandler>();
  private messageHandlers: MessageHandler[] = [];

  slash(command: string, handler: SlashCommandHandler) {
    this.slashCommands.set(command, handler);
    return this;
  }

  message(handler: MessageHandler) {
    this.messageHandlers.push(handler);
    return this;
  }

  async handleSlashCommand(interaction: ChatInputCommandInteraction) {
    const handler = this.slashCommands.get(interaction.commandName);
    if (handler) {
      await handler(interaction);
    }
  }

  async handleMessage(message: Message, botUserId: string) {
    for (const handler of this.messageHandlers) {
      await handler(message, botUserId);
    }
  }

  getRegisteredSlashCommands() {
    return Array.from(this.slashCommands.keys());
  }
}

const discordRouter = new DiscordRouter();

// Register slash commands
discordRouter.slash("clear", async (interaction) => {
  const { default: DiscordController } = await import(
    "#controllers/discord_controller"
  );
  const { default: OpenAIService } = await import("#services/openai_service");

  const openaiService = await app.container.make(OpenAIService);
  const controller = new DiscordController(openaiService);
  await controller.handleSlashCommand(interaction);
});

// Register message handlers
discordRouter.message(async (message, botUserId) => {
  const { default: DiscordController } = await import(
    "#controllers/discord_controller"
  );
  const { default: OpenAIService } = await import("#services/openai_service");

  const openaiService = await app.container.make(OpenAIService);
  const controller = new DiscordController(openaiService);
  await controller.handleMessage(message, botUserId);
});

export default discordRouter;
