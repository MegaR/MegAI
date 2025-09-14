import { assert } from "@japa/assert";
import app from "@adonisjs/core/services/app";
import type { Config } from "@japa/runner/types";
import { pluginAdonisJS } from "@japa/plugin-adonisjs";
import testUtils from "@adonisjs/core/services/test_utils";

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config["plugins"] = [assert(), pluginAdonisJS(app)];

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * The setup functions are executed before all the tests
 * The teardown functions are executed after all the tests
 */
export const runnerHooks: Required<Pick<Config, "setup" | "teardown">> = {
  setup: [
    async () => {
      // Import MigrationRunner directly and run migrations
      const { MigrationRunner } = await import("@adonisjs/lucid/migration");
      const db = await import("@adonisjs/lucid/services/db");

      const migrator = new MigrationRunner(db.default, app, {
        direction: "up",
        connectionName: "sqlite",
      });

      await migrator.run();
    },
  ],
  teardown: [],
};

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config["configureSuite"] = (suite) => {
  if (["browser", "functional", "e2e"].includes(suite.name)) {
    return suite.setup(() => testUtils.httpServer().start());
  }
};
