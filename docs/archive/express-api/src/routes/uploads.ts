import { Router } from "express";
import { createPresign } from "../controllers/uploadsController";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const uploadsRouter = Router();

uploadsRouter.post("/presign", rateLimit(), requireAuth, createPresign);
