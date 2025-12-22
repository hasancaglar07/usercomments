import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { ZodError } from "zod";
import { env } from "./env";
import { requestContext } from "./middleware/requestContext";
import { requestLogger } from "./middleware/requestLogger";
import { rateLimit } from "./middleware/rateLimit";
import { categoriesRouter } from "./routes/categories";
import { reviewsRouter } from "./routes/reviews";
import { usersRouter } from "./routes/users";
import { searchRouter } from "./routes/search";
import { uploadsRouter } from "./routes/uploads";
import { healthRouter } from "./routes/health";
import { sitemapRouter } from "./routes/sitemap";
import { adminRouter } from "./routes/admin";
import { commentsRouter } from "./routes/comments";

export const app = express();

const allowedOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 1 ? allowedOrigins : allowedOrigins[0],
  })
);
app.use(helmet());
app.use(compression());
app.use(requestContext);
app.use(requestLogger);
app.use(express.json({ limit: env.REQUEST_BODY_LIMIT }));

app.use("/api/auth", rateLimit());
app.use("/api/health", healthRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/users", usersRouter);
app.use("/api/search", searchRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/sitemap", sitemapRouter);
app.use("/api/admin", adminRouter);
app.use("/api/comments", commentsRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    void _next;
    const requestId = res.locals.requestId;
    const errorMessage =
      err && typeof err === "object" && "message" in err
        ? String(err.message)
        : "Internal Server Error";

    console.error(
      JSON.stringify({
        level: "error",
        message: "request_error",
        requestId,
        error: errorMessage,
      })
    );

    if (err instanceof ZodError) {
      res.status(400).json({
        error: "Invalid request",
        details: err.flatten(),
      });
      return;
    }

    res.status(500).json({ error: errorMessage });
  }
);
