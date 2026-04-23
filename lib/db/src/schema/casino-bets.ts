import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const casinoBetsTable = pgTable("casino_bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  game: text("game").notNull(),
  gameName: text("game_name").notNull(),
  roundId: text("round_id").notNull(),
  selection: text("selection").notNull(),
  stake: numeric("stake", { precision: 10, scale: 2 }).notNull(),
  payout: numeric("payout", { precision: 12, scale: 2 }),
  status: text("status").notNull().default("pending"),
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
});

export type CasinoBetRow = typeof casinoBetsTable.$inferSelect;
