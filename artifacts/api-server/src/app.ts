import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import router from "./routes";
import { logger } from "./lib/logger";

const PgSession = connectPgSimple(session);

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Ensure required tables exist on startup
pgPool.query(`
  CREATE TABLE IF NOT EXISTS "user_sessions" (
    "sid" varchar NOT NULL COLLATE "default",
    "sess" json NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
  );
  CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");

  CREATE TABLE IF NOT EXISTS "platform_settings" (
    "key" varchar(100) PRIMARY KEY,
    "value" text NOT NULL
  );
  INSERT INTO "platform_settings" ("key", "value")
  VALUES ('signup_bonus', '50000')
  ON CONFLICT ("key") DO NOTHING;
`).catch(err => logger.warn({ err }, "Startup table setup warning"));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new PgSession({
      pool: pgPool,
      tableName: "user_sessions",
    }),
    secret: process.env.SESSION_SECRET ?? "betpulse-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

export default app;
