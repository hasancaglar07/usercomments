import type { ParsedEnv } from "../env";
import { getSupabaseClient } from "../supabase";
import type {
  AdminReport,
  AdminReportTargetComment,
  AdminReportTargetReview,
  AdminReportTargetUser,
  CommentStatus,
  PaginationInfo,
  Report,
  ReportStatus,
  ReviewStatus,
  UserRole,
} from "../types";
import { buildPaginationInfo } from "../utils/pagination";

type ReportRow = {
  id: string;
  reporter_user_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  status: string;
};

type ReportReviewRow = {
  id: string;
  slug: string;
  title: string | null;
  status: string | null;
  profiles?:
    | { username: string | null }
    | { username: string | null }[]
    | null;
};

type ReportCommentRow = {
  id: string;
  review_id: string;
  text: string | null;
  status: string | null;
  profiles?:
    | { username: string | null }
    | { username: string | null }[]
    | null;
  reviews?:
    | { slug: string; title: string | null; status: string | null }
    | { slug: string; title: string | null; status: string | null }[]
    | null;
};

type ReportUserRow = {
  user_id: string;
  username: string;
  role: string | null;
  profile_pic_url: string | null;
  bio: string | null;
};

function pickRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function normalizeReviewStatus(value: string | null | undefined): ReviewStatus {
  if (
    value === "hidden" ||
    value === "deleted" ||
    value === "pending" ||
    value === "draft"
  ) {
    return value;
  }
  return "published";
}

function normalizeCommentStatus(value: string | null | undefined): CommentStatus {
  if (value === "hidden" || value === "deleted") {
    return value;
  }
  return "published";
}

function normalizeUserRole(value: string | null | undefined): UserRole {
  if (value === "admin" || value === "moderator") {
    return value;
  }
  return "user";
}

function mapReportRow(row: ReportRow): AdminReport {
  return {
    id: row.id,
    reporterUserId: row.reporter_user_id,
    targetType: row.target_type as Report["targetType"],
    targetId: row.target_id,
    reason: row.reason,
    details: row.details ?? undefined,
    createdAt: row.created_at,
    status: row.status as ReportStatus,
  };
}

export async function createReport(
  env: ParsedEnv,
  payload: {
    reporterUserId: string;
    targetType: Report["targetType"];
    targetId: string;
    reason: string;
    details?: string | null;
  }
): Promise<Report> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_user_id: payload.reporterUserId,
      target_type: payload.targetType,
      target_id: payload.targetId,
      reason: payload.reason,
      details: payload.details ?? null,
    })
    .select("id, reporter_user_id, target_type, target_id, reason, details, created_at, status")
    .single();

  if (error || !data) {
    throw error;
  }

  return mapReportRow(data as ReportRow);
}

export async function fetchReports(
  env: ParsedEnv,
  options: {
    status?: ReportStatus;
    page: number;
    pageSize: number;
  }
): Promise<{ items: AdminReport[]; pageInfo: PaginationInfo }> {
  const supabase = getSupabaseClient(env);
  const { status, page, pageSize } = options;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("reports")
    .select(
      "id, reporter_user_id, target_type, target_id, reason, details, created_at, status",
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw error;
  }

  const baseItems = (data ?? []).map((row) => mapReportRow(row as ReportRow));
  const reviewIds = baseItems
    .filter((item) => item.targetType === "review")
    .map((item) => item.targetId);
  const commentIds = baseItems
    .filter((item) => item.targetType === "comment")
    .map((item) => item.targetId);
  const userIds = baseItems
    .filter((item) => item.targetType === "user")
    .map((item) => item.targetId);

  const [reviewResult, commentResult, userResult] = await Promise.all([
    reviewIds.length
      ? supabase
          .from("reviews")
          .select("id, slug, title, status, profiles(username)")
          .in("id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
    commentIds.length
      ? supabase
          .from("comments")
          .select("id, review_id, text, status, profiles(username), reviews(slug, title, status)")
          .in("id", commentIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? supabase
          .from("profiles")
          .select("user_id, username, role, profile_pic_url, bio")
          .in("user_id", userIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (reviewResult.error) {
    throw reviewResult.error;
  }
  if (commentResult.error) {
    throw commentResult.error;
  }
  if (userResult.error) {
    throw userResult.error;
  }

  const reviewMap = new Map<string, AdminReportTargetReview>();
  (reviewResult.data ?? []).forEach((row) => {
    const reviewRow = row as ReportReviewRow;
    const profile = pickRelation(reviewRow.profiles);
    reviewMap.set(reviewRow.id, {
      id: reviewRow.id,
      slug: reviewRow.slug,
      title: reviewRow.title ?? "",
      status: normalizeReviewStatus(reviewRow.status),
      author: profile?.username ? { username: profile.username } : undefined,
    });
  });

  const commentMap = new Map<string, AdminReportTargetComment>();
  (commentResult.data ?? []).forEach((row) => {
    const commentRow = row as ReportCommentRow;
    const profile = pickRelation(commentRow.profiles);
    const review = pickRelation(commentRow.reviews);
    commentMap.set(commentRow.id, {
      id: commentRow.id,
      reviewId: commentRow.review_id,
      text: commentRow.text ?? "",
      status: normalizeCommentStatus(commentRow.status),
      reviewSlug: review?.slug,
      reviewTitle: review?.title ?? undefined,
      author: profile?.username ? { username: profile.username } : undefined,
    });
  });

  const userMap = new Map<string, AdminReportTargetUser>();
  (userResult.data ?? []).forEach((row) => {
    const userRow = row as ReportUserRow;
    userMap.set(userRow.user_id, {
      userId: userRow.user_id,
      username: userRow.username,
      role: normalizeUserRole(userRow.role),
      profilePicUrl: userRow.profile_pic_url ?? undefined,
      bio: userRow.bio ?? undefined,
    });
  });

  const items = baseItems.map((report) => {
    if (report.targetType === "review") {
      return {
        ...report,
        target: {
          review: reviewMap.get(report.targetId),
        },
      };
    }
    if (report.targetType === "comment") {
      return {
        ...report,
        target: {
          comment: commentMap.get(report.targetId),
        },
      };
    }
    if (report.targetType === "user") {
      return {
        ...report,
        target: {
          user: userMap.get(report.targetId),
        },
      };
    }
    return report;
  });

  return {
    items,
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function updateReportStatus(
  env: ParsedEnv,
  id: string,
  status: ReportStatus
): Promise<AdminReport | null> {
  const supabase = getSupabaseClient(env);
  const { data, error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", id)
    .select("id, reporter_user_id, target_type, target_id, reason, details, created_at, status")
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapReportRow(data as ReportRow);
}
