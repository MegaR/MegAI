/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from "@adonisjs/core/env";

export default await Env.create(new URL("../", import.meta.url), {
  NODE_ENV: Env.schema.enum(["development", "production", "test"] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: "host" }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring session package
  |----------------------------------------------------------
  */
  SESSION_DRIVER: Env.schema.enum(["cookie", "memory"] as const),

  /*
  |----------------------------------------------------------
  | Variables for configuring Discord bot
  |----------------------------------------------------------
  */
  DISCORD_BOT_TOKEN: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring OpenAI service
  |----------------------------------------------------------
  */
  OPENAI_API_KEY: Env.schema.string(),
  OPENAI_BASE_URL: Env.schema.string.optional(),
  OPENAI_MODEL: Env.schema.string.optional(),
});
