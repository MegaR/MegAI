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

    this.app.container.singleton(DiscordService, async () => {
      return new DiscordService();
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

    // Only start Discord bot if token is provided and not in test environment
    const token = process.env.DISCORD_BOT_TOKEN;
    if (token && !this.app.inTest) {
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
    // Only stop Discord if not in test (since it won't be running in test)
    if (!this.app.inTest) {
      const discord = await this.app.container.make(DiscordService);
      await discord.stop();
    }
  }
}
