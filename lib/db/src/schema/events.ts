import { pgTable, text, serial, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  sport: text("sport").notNull(),
  league: text("league"),
  homeTeam: text("home_team").notNull(),
  awayTeam: text("away_team").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("upcoming"),
  oddsHome: numeric("odds_home", { precision: 8, scale: 2 }).notNull(),
  oddsDraw: numeric("odds_draw", { precision: 8, scale: 2 }).notNull(),
  oddsAway: numeric("odds_away", { precision: 8, scale: 2 }).notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  result: text("result"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof eventsTable.$inferSelect;
