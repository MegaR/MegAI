import { Client, GatewayIntentBits, Events, Message } from 'discord.js'
import logger from '@adonisjs/core/services/logger'
import env from '#start/env'

export default class DiscordService {
  private client: Client
  private isReady = false

  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    })

    this.setupEventHandlers()
  }

  private setupEventHandlers() {
    this.client.once(Events.ClientReady, (readyClient) => {
      this.isReady = true
      logger.info(`Discord bot ready! Logged in as ${readyClient.user.tag}`)
    })

    this.client.on(Events.MessageCreate, async (message: Message) => {
      if (message.author.bot) return

      // Simple ping command
      if (message.content === '!ping') {
        await message.reply('Pong!')
      }

      // AI command placeholder
      if (message.content.startsWith('!ai ')) {
        const prompt = message.content.slice(4)
        await message.reply(`You asked: "${prompt}". AI functionality coming soon!`)
      }
    })

    this.client.on(Events.Error, (error) => {
      logger.error('Discord client error:', error)
    })
  }

  async start() {
    try {
      await this.client.login(env.get('DISCORD_BOT_TOKEN'))
      logger.info('Discord bot login initiated')
    } catch (error) {
      logger.error('Failed to start Discord bot:', error)
      throw error
    }
  }

  async stop() {
    if (this.client) {
      this.client.destroy()
      this.isReady = false
      logger.info('Discord bot stopped')
    }
  }

  getClient() {
    return this.client
  }

  isClientReady() {
    return this.isReady
  }
}
