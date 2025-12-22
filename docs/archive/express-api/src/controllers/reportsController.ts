import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createReport } from "../services/reportsService";
import { fetchProfileByUserId } from "../services/profilesService";
import {
  fetchReviewMetaById,
  fetchCommentStatusById,
} from "../services/reviewsService";

const reportBodySchema = z.object({
  reason: z.string().min(3).max(200),
  details: z.string().max(1000).optional(),
});

const reviewParamSchema = z.object({
  id: z.string().uuid(),
});

const commentParamSchema = z.object({
  id: z.string().uuid(),
});

const userParamSchema = z.object({
  userId: z.string().uuid(),
});

export async function reportReview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = reviewParamSchema.parse(req.params);
    const { reason, details } = reportBodySchema.parse(req.body);

    const meta = await fetchReviewMetaById(id);
    if (!meta || meta.status !== "published") {
      res.status(404).json({ error: "Review not found" });
      return;
    }

    const report = await createReport({
      reporterUserId: req.user.id,
      targetType: "review",
      targetId: id,
      reason,
      details,
    });

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
}

export async function reportComment(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { id } = commentParamSchema.parse(req.params);
    const { reason, details } = reportBodySchema.parse(req.body);

    const comment = await fetchCommentStatusById(id);
    if (!comment || comment.status !== "published") {
      res.status(404).json({ error: "Comment not found" });
      return;
    }

    const report = await createReport({
      reporterUserId: req.user.id,
      targetType: "comment",
      targetId: id,
      reason,
      details,
    });

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
}

export async function reportUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { userId } = userParamSchema.parse(req.params);
    const { reason, details } = reportBodySchema.parse(req.body);

    const profile = await fetchProfileByUserId(userId);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const report = await createReport({
      reporterUserId: req.user.id,
      targetType: "user",
      targetId: userId,
      reason,
      details,
    });

    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
}
