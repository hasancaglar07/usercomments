import { supabase } from "../db/supabase";
import type { PaginationInfo, Report, ReportStatus } from "../types/api";
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

function mapReportRow(row: ReportRow): Report {
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

export async function createReport(payload: {
  reporterUserId: string;
  targetType: Report["targetType"];
  targetId: string;
  reason: string;
  details?: string | null;
}): Promise<Report> {
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

export async function fetchReports(options: {
  status?: ReportStatus;
  page: number;
  pageSize: number;
}): Promise<{ items: Report[]; pageInfo: PaginationInfo }> {
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

  return {
    items: (data ?? []).map((row) => mapReportRow(row as ReportRow)),
    pageInfo: buildPaginationInfo(page, pageSize, count ?? 0),
  };
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus
): Promise<Report | null> {
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
