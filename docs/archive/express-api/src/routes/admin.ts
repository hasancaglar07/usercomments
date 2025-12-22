import { Router } from "express";
import {
  getReports,
  patchCommentStatus,
  patchReportStatus,
  patchReviewStatus,
  patchUserRole,
} from "../controllers/adminController";
import { requireAuth, requireRole } from "../middleware/auth";
import { noStore } from "../middleware/noStore";

export const adminRouter = Router();

adminRouter.use(noStore, requireAuth);

adminRouter.get("/reports", requireRole(["admin", "moderator"]), getReports);
adminRouter.patch(
  "/reports/:id",
  requireRole(["admin", "moderator"]),
  patchReportStatus
);
adminRouter.patch(
  "/reviews/:id/status",
  requireRole(["admin", "moderator"]),
  patchReviewStatus
);
adminRouter.patch(
  "/comments/:id/status",
  requireRole(["admin", "moderator"]),
  patchCommentStatus
);
adminRouter.patch(
  "/users/:userId/role",
  requireRole("admin"),
  patchUserRole
);
