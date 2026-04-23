import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { eventsTable } from "./events";

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  eventId: integer("event_id").notNull().references(() => eventsTable.id),
  selection: text("selection").notNull(),
  stake: numeric("stake", { precision: 10, scale: 2 }).notNull(),
  odds: numeric("odds", { precision: 8, scale: 2 }).notNull(),
  potentialWin: numeric("potential_win", { precision: 12, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export const insertBetSchema = createInsertSchema(betsTable).omit({
  id: true,
  createdAt: true,
  settledAt: true,
});
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof betsTable.$inferSelect;
