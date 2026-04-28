import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Optional safety log (useful for debugging)
logger.info(
  {
    port,
    nodeEnv: process.env.NODE_ENV,
    db: process.env.DATABASE_URL ? "loaded" : "missing"
  },
  "Starting server..."
);

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server running successfully");
});