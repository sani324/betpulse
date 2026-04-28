import "dotenv/config";

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// ✅ Safe env handling
const connectionString =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "No database connection string found. Set NEON_DATABASE_URL or DATABASE_URL."
  );
}

// ✅ PostgreSQL pool
export const pool = new Pool({
  connectionString,

  // Neon cloud requires SSL
  ssl: connectionString.includes("neon.tech")
    ? { rejectUnauthorized: false }
    : undefined,
});

// ✅ Drizzle ORM instance
export const db = drizzle(pool, {
  schema,
});

// ✅ re-export schema for convenience
export * from "./schema";