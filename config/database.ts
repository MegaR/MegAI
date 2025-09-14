import app from "@adonisjs/core/services/app";
import { defineConfig } from "@adonisjs/lucid";

const dbConfig = defineConfig({
  connection: "sqlite",
  connections: {
    sqlite: {
      client: "better-sqlite3",
      connection: {
        filename: app.inTest
          ? app.tmpPath(`test_db_${process.pid}_${Date.now()}.sqlite3`)
          : app.makePath("database", "db.sqlite3"),
      },
      useNullAsDefault: true,
      migrations: {
        naturalSort: true,
        paths: ["database/migrations"],
      },
    },
  },
});

export default dbConfig;
