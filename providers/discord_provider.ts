import DiscordService from "#services/discord_service";
import OpenAIService from "#services/openai_service";
import { ApplicationService } from "@adonisjs/core/types";
import env from "#start/env";

export default class DiscordProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {
    this.app.container.singleton(OpenAIService, async () => {
      const apiKey = env.get("OPENAI_API_KEY");
      const baseURL = env.get("OPENAI_BASE_URL");
      const model = env.get("OPENAI_MODEL");
      return new OpenAIService(apiKey, baseURL, model);
    });

    this.app.container.singleton(DiscordService, async (resolver) => {
      const openaiService = await resolver.make(OpenAIService);
      return new DiscordService(openaiService);
    });
  }

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {
    const discord = await this.app.container.make(DiscordService);

    // Only start Discord bot if token is provided
    const token = process.env.DISCORD_BOT_TOKEN;
    if (token) {
      await discord.start();
    }
  }

  /**
   * The process has been started
   */
  async ready() {}

  /**
   * Preparing to shutdown the app
   */
  async shutdown() {
    const discord = await this.app.container.make(DiscordService);
    await discord.stop();
  }
}
