import { pgTable, text, serial, timestamp, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("user"),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("1000.00"),
  bonusBalance: numeric("bonus_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalDeposited: numeric("total_deposited", { precision: 12, scale: 2 }).notNull().default("1000.00"),
  totalWagered: numeric("total_wagered", { precision: 12, scale: 2 }).notNull().default("0.00"),
  totalWon: numeric("total_won", { precision: 12, scale: 2 }).notNull().default("0.00"),
  isBlocked: boolean("is_blocked").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
