import DiscordService from '#services/discord_service'
import { ApplicationService } from '@adonisjs/core/types'

export default class DiscordProvider {
  constructor(protected app: ApplicationService) {}

  /**
   * Register bindings to the container
   */
  register() {
    this.app.container.singleton('discord', () => {
      return new DiscordService()
    })
  }

  /**
   * The container bindings have booted
   */
  async boot() {}

  /**
   * The application has been booted
   */
  async start() {
    const discord = await this.app.container.make('discord')

    // Only start Discord bot if token is provided
    const token = process.env.DISCORD_BOT_TOKEN
    if (token) {
      await discord.start()
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
    const discord = await this.app.container.make('discord')
    await discord.stop()
  }
}
