import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createPresignedUploadUrl } from "../services/uploadsService";

const presignSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
});

export async function createPresign(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const { filename, contentType } = presignSchema.parse(req.body);
    const result = await createPresignedUploadUrl(
      req.user.id,
      filename,
      contentType
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}
