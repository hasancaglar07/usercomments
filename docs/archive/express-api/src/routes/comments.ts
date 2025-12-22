import { Router } from "express";
import { reportComment } from "../controllers/reportsController";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const commentsRouter = Router();

commentsRouter.post("/:id/report", rateLimit(), requireAuth, reportComment);
