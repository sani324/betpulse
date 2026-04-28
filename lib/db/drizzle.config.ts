import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import path from "path";

const connectionString =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("No database URL found");
}

export default defineConfig({
  schema: "./src/schema", // ✅ SIMPLE RELATIVE PATH ONLY
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});