import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { Pool } from "pg";
import router from "./routes";
import { logger } from "./lib/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PgSession = connectPgSimple(session);

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

import bcrypt from "bcryptjs";

// Ensure required tables & admin accounts exist on startup
(async () => {
  try {
    await pgPool.query(`
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
    `);

    const passHash = await bcrypt.hash("BetPulseAdmin#2016!Sec", 10);
    
    // Ensure kaloti@betpulse.com admin account
    await pgPool.query(`
      INSERT INTO users (username, email, password_hash, role, balance, total_deposited)
      VALUES ('kaloti', 'kaloti@betpulse.com', $1, 'admin', '1000000.00', '0.00')
      ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = $1;
    `, [passHash]);

    // Ensure admin@betpulse.com admin account
    await pgPool.query(`
      INSERT INTO users (username, email, password_hash, role, balance, total_deposited)
      VALUES ('admin', 'admin@betpulse.com', $1, 'admin', '1000000.00', '0.00')
      ON CONFLICT (email) DO UPDATE SET role = 'admin';
    `, [passHash]);

    logger.info("Admin accounts verified and ready");
  } catch (err) {
    logger.warn({ err }, "Startup database setup warning");
  }
})();

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.set("trust proxy", 1);
}

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
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

app.use("/api", router);

// Serve frontend static files in production (single-service deployment)
if (isProduction) {
  const frontendPath = path.resolve(__dirname, "../../betpulse/dist/public");
  app.use(express.static(frontendPath));
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

export default app;