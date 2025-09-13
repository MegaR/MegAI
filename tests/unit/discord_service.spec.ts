import DiscordService from "#services/discord_service";
import OpenAIService from "#services/openai_service";
import { test } from "@japa/runner";

test.group("Discord Service", () => {
  test("should create Discord client with correct intents", ({ assert }) => {
    const openaiService = new OpenAIService("test-api-key");
    const service = new DiscordService(openaiService);
    const client = service.getClient();

    assert.isTrue(client.options.intents.has("Guilds"));
    assert.isTrue(client.options.intents.has("GuildMessages"));
    assert.isTrue(client.options.intents.has("MessageContent"));
  });

  test("should not be ready initially", ({ assert }) => {
    const openaiService = new OpenAIService("test-api-key");
    const service = new DiscordService(openaiService);
    assert.isFalse(service.isClientReady());
  });
});
