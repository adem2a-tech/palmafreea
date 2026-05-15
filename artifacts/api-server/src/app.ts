import express, { type Express } from "express";
import type { IncomingMessage, ServerResponse } from "node:http";
import cors from "cors";
import { pinoHttp } from "pino-http";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
/** Chemin fichier explicite : Node ESM sur Vercel rejette `import "./routes"` (répertoire sans index résolu). */
import router from "./routes/index.js";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const pgSession = connectPgSimple(session);

const app: Express = express();

/** Sur Vercel : `VERCEL` n’est pas toujours la chaîne `"1"` ; `VERCEL_ENV` est toujours défini en déploiement. */
const usePostgresSessionStore = !process.env.VERCEL_ENV;

/** Requis derrière le proxy TLS de Vercel (cookies `secure`, IP réelle). */
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true, limit: "12mb" }));

if (!process.env.SESSION_SECRET) {
  logger.warn("SESSION_SECRET not set, using default secret. This is not secure!");
}

app.use(
  session({
    ...(usePostgresSessionStore
      ? {
          store: new pgSession({
            pool,
            tableName: "session",
            createTableIfMissing: true,
          }),
        }
      : {}),
    secret: process.env.SESSION_SECRET || "palma-fa-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure:
        process.env.NODE_ENV === "production" ||
        Boolean(process.env.VERCEL_ENV),
      httpOnly: true,
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    logger.error({ err }, "express_error_handler");
    if (!res.headersSent) {
      res.status(500).json({
        error: "InternalServerError",
        message:
          process.env.VERCEL_ENV
            ? "Une erreur est survenue (voir logs Vercel)."
            : String((err as Error)?.message ?? err),
      });
    }
  },
);

export default app;
