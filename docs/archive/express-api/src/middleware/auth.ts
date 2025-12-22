import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { supabase } from "../db/supabase";
import {
  ensureProfileForUser,
  fetchProfileRole,
} from "../services/profilesService";

export type UserRole = "user" | "moderator" | "admin";

export type AuthUser = {
  id: string;
  email?: string | null;
  role: UserRole;
};

function parseBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

async function loadUserFromToken(token: string): Promise<AuthUser | null> {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const baseUser: AuthUser = {
    id: data.user.id,
    email: data.user.email,
    role: "user",
  };

  await ensureProfileForUser(baseUser);
  const role = await fetchProfileRole(baseUser.id);
  return { ...baseUser, role };
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = parseBearerToken(req);
    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const user = await loadUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireVoteIdentity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = parseBearerToken(req);
    if (token) {
      const user = await loadUserFromToken(token);
      if (user) {
        req.user = user;
        next();
        return;
      }
    }

    const ip = req.ip || req.connection.remoteAddress || "";
    if (!ip) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const hash = crypto.createHash("sha256").update(ip).digest("hex");
    req.voteIdentity = { ipHash: hash };
    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(roles: UserRole | UserRole[]) {
  const allowed = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!allowed.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
