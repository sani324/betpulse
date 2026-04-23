import { pgTable, varchar, text } from "drizzle-orm/pg-core";

export const platformSettingsTable = pgTable("platform_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value").notNull(),
});
