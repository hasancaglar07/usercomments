import type { ParsedEnv } from "./env";
import { getSupabaseClient } from "./supabase";
import { ensureProfileForUser, fetchProfileRole } from "./services/profiles";

export type UserRole = "user" | "moderator" | "admin";

export type AuthUser = {
  id: string;
  email?: string | null;
  role: UserRole;
};

function parseBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) {
    return null;
  }
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token;
}

export async function getAuthUser(
  request: Request,
  env: ParsedEnv
): Promise<AuthUser | null> {
  const token = parseBearerToken(request);
  if (!token) {
    return null;
  }

  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }

  const baseUser: AuthUser = {
    id: data.user.id,
    email: data.user.email,
    role: "user",
  };

  await ensureProfileForUser(env, baseUser);
  const role = await fetchProfileRole(env, baseUser.id);
  return { ...baseUser, role };
}

export function hasRole(user: AuthUser, roles: UserRole | UserRole[]): boolean {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return allowed.includes(user.role);
}
