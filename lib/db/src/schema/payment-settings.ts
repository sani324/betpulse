import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const paymentSettingsTable = pgTable("payment_settings", {
  method: text("method").primaryKey(),
  label: text("label").notNull(),
  accountName: text("account_name").notNull().default(""),
  accountNumber: text("account_number").notNull().default(""),
  instructions: text("instructions").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PaymentSetting = typeof paymentSettingsTable.$inferSelect;
