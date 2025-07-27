import DiscordService from '#services/discord_service'
import { test } from '@japa/runner'

test.group('Discord Service', () => {
  test('should create Discord client with correct intents', ({ assert }) => {
    const service = new DiscordService()
    const client = service.getClient()

    assert.isTrue(client.options.intents.has('Guilds'))
    assert.isTrue(client.options.intents.has('GuildMessages'))
    assert.isTrue(client.options.intents.has('MessageContent'))
  })

  test('should not be ready initially', ({ assert }) => {
    const service = new DiscordService()
    assert.isFalse(service.isClientReady())
  })
})
