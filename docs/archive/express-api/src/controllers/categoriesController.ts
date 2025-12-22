import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  fetchCategories,
  fetchSubcategories,
} from "../services/categoriesService";
import { buildPaginationInfo } from "../utils/pagination";

const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export async function getCategories(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const categories = await fetchCategories();
    res.json({
      items: categories,
      pageInfo: buildPaginationInfo(1, categories.length, categories.length),
    });
  } catch (error) {
    next(error);
  }
}

export async function getSubcategories(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const { id } = idParamSchema.parse(req.params);
    const categories = await fetchSubcategories(id);
    res.json({
      items: categories,
      pageInfo: buildPaginationInfo(1, categories.length, categories.length),
    });
  } catch (error) {
    next(error);
  }
}
