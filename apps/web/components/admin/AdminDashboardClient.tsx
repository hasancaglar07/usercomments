"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import type {
  AdminComment,
  AdminReport,
  AdminReview,
  AdminUser,
  AdminUserDetail,
  Category,
  CommentStatus,
  PaginationInfo,
  ReportStatus,
  ReviewStatus,
  UserRole,
} from "@/src/types";
import {
  formatCompactNumber,
  formatNumber,
  formatRelativeTime,
} from "@/src/lib/review-utils";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import {
  bulkUpdateAdminCommentStatus,
  bulkUpdateAdminReportStatus,
  bulkUpdateAdminReviewStatus,
  createAdminCategory,
  getAdminCategories,
  getAdminComments,
  getAdminReports,
  getAdminReviewDetail,
  getAdminReviews,
  getAdminUserDetail,
  getAdminUsers,
  updateAdminCategory,
  updateAdminComment,
  updateAdminCommentStatus,
  updateAdminReportStatus,
  updateAdminReview,
  updateAdminReviewStatus,
  updateAdminUserProfile,
  updateAdminUserRole,
} from "@/src/lib/api-client";

const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required."),
  parentId: z.number().int().positive().nullable().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required."),
  parentId: z.number().int().positive().nullable().optional(),
});

const reviewEditSchema = z.object({
  title: z.string().trim().min(3).max(160),
  excerpt: z.string().trim().min(10).max(300),
  contentHtml: z.string().min(10),
  photoUrls: z.array(z.string().url()),
  categoryId: z.number().int().positive(),
  subCategoryId: z.number().int().positive().nullable().optional(),
});

const commentEditSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

const userUpdateSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[a-z0-9_-]+$/i, "username must be alphanumeric with - or _." )
      .optional(),
    bio: z.string().trim().max(280).nullable().optional(),
    profilePicUrl: z.string().url().nullable().optional(),
  })
  .refine(
    (value) =>
      value.username !== undefined ||
      value.bio !== undefined ||
      value.profilePicUrl !== undefined,
    "At least one field is required."
  );

type ReviewPreviewBlock =
  | { type: "paragraph"; lines: string[] }
  | { type: "list"; items: string[] };

function buildReviewPreviewBlocks(contentHtml: string): ReviewPreviewBlock[] {
  const normalized = contentHtml
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return [];
  }

  const blocks: ReviewPreviewBlock[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ type: "paragraph", lines: paragraphLines });
      paragraphLines = [];
    }
  };

  const flushList = () => {
    if (listItems.length > 0) {
      blocks.push({ type: "list", items: listItems });
      listItems = [];
    }
  };

  normalized.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
      return;
    }
    const isListItem = /^[-*]\s+/.test(trimmed);
    if (isListItem) {
      flushParagraph();
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      return;
    }
    if (listItems.length > 0) {
      flushList();
    }
    paragraphLines.push(trimmed);
  });

  flushParagraph();
  flushList();

  return blocks;
}

const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const REVIEW_COMMENT_PAGE_SIZE = 5;

const reviewStatusFilters = [
  "all",
  "pending",
  "published",
  "hidden",
  "deleted",
  "draft",
] as const;
const reviewStatusOptions = [
  "pending",
  "published",
  "hidden",
  "deleted",
  "draft",
] as const;

const commentStatusFilters = ["all", "published", "hidden", "deleted"] as const;
const commentStatusOptions = ["published", "hidden", "deleted"] as const;

const reportStatusFilters = ["all", "open", "resolved", "rejected"] as const;
const reportTargetFilters = ["all", "review", "comment", "user"] as const;
const reportStatusOptions = ["resolved", "rejected"] as const;

const userRoleOptions = ["user", "moderator", "admin"] as const;

const tabs = [
  { key: "reviews", label: "Reviews" },
  { key: "comments", label: "Comments" },
  { key: "reports", label: "Reports" },
  { key: "users", label: "Users" },
  { key: "categories", label: "Categories" },
] as const;

type TabKey = (typeof tabs)[number]["key"];

type ReviewStatusFilter = (typeof reviewStatusFilters)[number];
type CommentStatusFilter = (typeof commentStatusFilters)[number];
type ReportStatusFilter = (typeof reportStatusFilters)[number];
type ReportTargetFilter = (typeof reportTargetFilters)[number];

type PaginationProps = {
  pagination: PaginationInfo | null;
  onPageChange: (page: number) => void;
};

const reviewStatusStyles: Record<ReviewStatus, string> = {
  published: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  hidden: "bg-slate-200 text-slate-600",
  deleted: "bg-rose-100 text-rose-700",
  draft: "bg-indigo-100 text-indigo-700",
};

const commentStatusStyles: Record<CommentStatus, string> = {
  published: "bg-emerald-100 text-emerald-700",
  hidden: "bg-slate-200 text-slate-600",
  deleted: "bg-rose-100 text-rose-700",
};

const reportStatusStyles: Record<ReportStatus, string> = {
  open: "bg-amber-100 text-amber-700",
  resolved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const userRoleStyles: Record<UserRole, string> = {
  admin: "bg-indigo-100 text-indigo-700",
  moderator: "bg-sky-100 text-sky-700",
  user: "bg-slate-100 text-slate-600",
};

function getPageItems(currentPage: number, totalPages: number) {
  const pages = new Set<number>([1, 2, totalPages]);
  pages.add(currentPage);
  pages.add(currentPage - 1);
  pages.add(currentPage + 1);

  const sorted = Array.from(pages)
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);

  const items: Array<number | "ellipsis"> = [];
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1];
    if (previous && page - previous > 1) {
      items.push("ellipsis");
    }
    items.push(page);
  });

  return items;
}

function PaginationControls({ pagination, onPageChange }: PaginationProps) {
  if (!pagination || pagination.totalPages <= 1) {
    return null;
  }

  const items = getPageItems(pagination.page, pagination.totalPages);
  const lastPage = Math.max(1, pagination.totalPages);
  const prevPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(lastPage, pagination.page + 1);
  const isFirst = pagination.page <= 1;
  const isLast = pagination.page >= pagination.totalPages;
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      <button
        type="button"
        className={`size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 ${isFirst ? disabledClass : ""}`}
        onClick={() => onPageChange(prevPage)}
        disabled={isFirst}
      >
        <span className="material-symbols-outlined text-[20px]">
          chevron_left
        </span>
      </button>
      {items.map((item, index) => {
        if (item === "ellipsis") {
          return (
            <span key={`ellipsis-${index}`} className="text-slate-400 text-sm">
              ...
            </span>
          );
        }
        if (item === pagination.page) {
          return (
            <span
              key={`page-${item}`}
              className="size-9 flex items-center justify-center rounded-lg bg-primary text-white font-bold text-sm"
            >
              {item}
            </span>
          );
        }
        return (
          <button
            key={`page-${item}`}
            type="button"
            className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm"
            onClick={() => onPageChange(item)}
          >
            {item}
          </button>
        );
      })}
      <button
        type="button"
        className={`size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 ${isLast ? disabledClass : ""}`}
        onClick={() => onPageChange(nextPage)}
        disabled={isLast}
      >
        <span className="material-symbols-outlined text-[20px]">
          chevron_right
        </span>
      </button>
    </div>
  );
}

function formatId(value: string) {
  return value.length > 8 ? `${value.slice(0, 8)}...` : value;
}

function toPlainText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function updatePaginationTotal(
  pagination: PaginationInfo | null,
  delta: number
): PaginationInfo | null {
  if (!pagination || pagination.totalItems === undefined) {
    return pagination;
  }
  const totalItems = Math.max(0, pagination.totalItems + delta);
  const totalPages = Math.max(1, Math.ceil(totalItems / pagination.pageSize));
  return { ...pagination, totalItems, totalPages };
}

function toggleSelection(selected: string[], id: string) {
  if (selected.includes(id)) {
    return selected.filter((item) => item !== id);
  }
  return [...selected, id];
}

function toggleSelectAll(selected: string[], ids: string[]) {
  if (selected.length === ids.length) {
    return [];
  }
  return ids;
}

export default function AdminDashboardClient() {
  const router = useRouter();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("reviews");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryPageInfo, setCategoryPageInfo] = useState<PaginationInfo | null>(null);
  const [categoryMessage, setCategoryMessage] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [reviewPageInfo, setReviewPageInfo] = useState<PaginationInfo | null>(null);
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>(
    "pending"
  );
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewPageSize, setReviewPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reviewQuery, setReviewQuery] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [reviewBulkStatus, setReviewBulkStatus] = useState<ReviewStatus>("published");

  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [reviewDetail, setReviewDetail] = useState<AdminReview | null>(null);
  const [reviewDetailLoading, setReviewDetailLoading] = useState(false);
  const [reviewDetailError, setReviewDetailError] = useState<string | null>(null);
  const [reviewStatusEdit, setReviewStatusEdit] = useState<ReviewStatus>("pending");
  const [reviewEdit, setReviewEdit] = useState<{
    title: string;
    excerpt: string;
    contentHtml: string;
    photoUrls: string;
    categoryId: string;
    subCategoryId: string;
  } | null>(null);
  const reviewPreviewBlocks = useMemo(
    () => buildReviewPreviewBlocks(reviewEdit?.contentHtml ?? ""),
    [reviewEdit?.contentHtml]
  );
  const [reviewComments, setReviewComments] = useState<AdminComment[]>([]);
  const [reviewCommentsPageInfo, setReviewCommentsPageInfo] =
    useState<PaginationInfo | null>(null);
  const [reviewCommentsLoading, setReviewCommentsLoading] = useState(false);
  const [reviewCommentsError, setReviewCommentsError] = useState<string | null>(
    null
  );

  const [comments, setComments] = useState<AdminComment[]>([]);
  const [commentPageInfo, setCommentPageInfo] = useState<PaginationInfo | null>(null);
  const [commentStatusFilter, setCommentStatusFilter] = useState<CommentStatusFilter>(
    "all"
  );
  const [commentPage, setCommentPage] = useState(1);
  const [commentPageSize, setCommentPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [commentQuery, setCommentQuery] = useState("");
  const [commentReviewFilter, setCommentReviewFilter] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentMessage, setCommentMessage] = useState<string | null>(null);
  const [selectedCommentIds, setSelectedCommentIds] = useState<string[]>([]);
  const [commentBulkStatus, setCommentBulkStatus] = useState<CommentStatus>(
    "published"
  );

  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [commentDetail, setCommentDetail] = useState<AdminComment | null>(null);
  const [commentEditText, setCommentEditText] = useState("");
  const [commentStatusEdit, setCommentStatusEdit] = useState<CommentStatus>("published");

  const [reports, setReports] = useState<AdminReport[]>([]);
  const [reportPageInfo, setReportPageInfo] = useState<PaginationInfo | null>(null);
  const [reportStatusFilter, setReportStatusFilter] = useState<ReportStatusFilter>(
    "open"
  );
  const [reportTargetFilter, setReportTargetFilter] = useState<ReportTargetFilter>(
    "all"
  );
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [reportQuery, setReportQuery] = useState("");
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportsMessage, setReportsMessage] = useState<string | null>(null);
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([]);
  const [reportBulkStatus, setReportBulkStatus] = useState<ReportStatus>("resolved");
  const [reportTargetReviewDetail, setReportTargetReviewDetail] =
    useState<AdminReview | null>(null);
  const [reportTargetUserDetail, setReportTargetUserDetail] =
    useState<AdminUserDetail | null>(null);
  const [reportTargetLoading, setReportTargetLoading] = useState(false);
  const [reportTargetError, setReportTargetError] = useState<string | null>(null);

  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPageInfo, setUserPageInfo] = useState<PaginationInfo | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [userPageSize, setUserPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [userQuery, setUserQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersMessage, setUsersMessage] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);
  const [userEdit, setUserEdit] = useState<{
    username: string;
    bio: string;
    profilePicUrl: string;
  } | null>(null);
  const [userRoleEdit, setUserRoleEdit] = useState<UserRole>("user");

  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryParentId, setNewCategoryParentId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editCategoryName, setEditCategoryName] = useState("");
  const [editCategoryParentId, setEditCategoryParentId] = useState("");

  const categoryLookup = useMemo(() => {
    const map = new Map<number, Category>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  const topCategories = useMemo(
    () => categories.filter((category) => !category.parentId),
    [categories]
  );

  const subcategoriesByParent = useMemo(() => {
    const map = new Map<number, Category[]>();
    categories.forEach((category) => {
      if (!category.parentId) {
        return;
      }
      const list = map.get(category.parentId) ?? [];
      list.push(category);
      map.set(category.parentId, list);
    });
    return map;
  }, [categories]);

  const reviewFilterLabel = reviewStatusFilter === "all" ? "All" : reviewStatusFilter;
  const commentFilterLabel =
    commentStatusFilter === "all" ? "All" : commentStatusFilter;
  const reportFilterLabel = reportStatusFilter === "all" ? "All" : reportStatusFilter;

  const filteredReviews = useMemo(() => {
    const query = reviewQuery.trim().toLowerCase();
    if (!query) {
      return reviews;
    }
    return reviews.filter((review) => {
      const haystack = [
        review.title,
        review.slug,
        review.author.username,
        review.excerpt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [reviews, reviewQuery]);

  const filteredComments = useMemo(() => {
    const query = commentQuery.trim().toLowerCase();
    if (!query) {
      return comments;
    }
    return comments.filter((comment) => {
      const haystack = [
        comment.text,
        comment.author.username,
        comment.review?.title,
        comment.review?.slug,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [comments, commentQuery]);

  const filteredReports = useMemo(() => {
    const query = reportQuery.trim().toLowerCase();
    return reports.filter((report) => {
      if (reportTargetFilter !== "all" && report.targetType !== reportTargetFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const targetDetail =
        report.target?.review?.title ||
        report.target?.comment?.text ||
        report.target?.user?.username;
      const haystack = [
        report.reason,
        report.details,
        report.targetId,
        targetDetail,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [reports, reportQuery, reportTargetFilter]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((user) => {
      const haystack = [user.username, user.role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [users, userQuery]);

  const activeReport = useMemo(() => {
    if (!activeReportId) {
      return null;
    }
    return reports.find((report) => report.id === activeReportId) ?? null;
  }, [reports, activeReportId]);

  const ensureAdminSession = useCallback(async () => {
    await ensureAuthLoaded();
    if (!getAccessToken()) {
      const loginPath = localizePath("/user/login", lang);
      const nextPath = localizePath("/admin", lang);
      router.replace(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
      return false;
    }
    return true;
  }, [lang, router]);

  const extractErrorMessage = useCallback((error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "string") {
      return error;
    }
    return "";
  }, []);

  const handleAccessError = useCallback((message: string) => {
    if (!message) {
      return;
    }
    const lower = message.toLowerCase();
    if (lower.includes("403") || lower.includes("forbidden")) {
      setErrorMessage("Access denied. Admin role is required.");
      return;
    }
    if (lower.includes("401") || lower.includes("unauthorized")) {
      setErrorMessage("Session expired. Please sign in again.");
    }
  }, []);

  const loadCategories = useCallback(async () => {
    setCategoryLoading(true);
    setCategoryError(null);
    try {
      const result = await getAdminCategories();
      setCategories(result.items);
      setCategoryPageInfo(result.pageInfo);
    } catch (error) {
      console.error("Failed to load categories", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCategoryError("Unable to load categories.");
    } finally {
      setCategoryLoading(false);
    }
  }, [extractErrorMessage, handleAccessError]);

  const loadReviews = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const status = reviewStatusFilter === "all" ? undefined : reviewStatusFilter;
      const result = await getAdminReviews({
        status,
        page: reviewPage,
        pageSize: reviewPageSize,
      });
      setReviews(result.items);
      setReviewPageInfo(result.pageInfo);
      setSelectedReviewIds([]);
    } catch (error) {
      console.error("Failed to load reviews", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReviewError("Unable to load reviews.");
    } finally {
      setReviewLoading(false);
    }
  }, [
    extractErrorMessage,
    handleAccessError,
    reviewPage,
    reviewPageSize,
    reviewStatusFilter,
  ]);

  const loadReviewDetail = useCallback(
    async (reviewId: string) => {
      setReviewDetailLoading(true);
      setReviewDetailError(null);
      try {
        const detail = await getAdminReviewDetail(reviewId);
        setReviewDetail(detail);
        setReviewStatusEdit(detail.status);
        setReviewEdit({
          title: detail.title,
          excerpt: detail.excerpt,
          contentHtml: detail.contentHtml ?? "",
          photoUrls: (detail.photoUrls ?? []).join("\n"),
          categoryId: detail.categoryId ? String(detail.categoryId) : "",
          subCategoryId: detail.subCategoryId ? String(detail.subCategoryId) : "",
        });
      } catch (error) {
        console.error("Failed to load review detail", error);
        const message = extractErrorMessage(error);
        handleAccessError(message);
        setReviewDetailError("Unable to load review details.");
      } finally {
        setReviewDetailLoading(false);
      }
    },
    [extractErrorMessage, handleAccessError]
  );

  const loadReviewComments = useCallback(
    async (reviewId: string) => {
      setReviewCommentsLoading(true);
      setReviewCommentsError(null);
      try {
        const result = await getAdminComments({
          reviewId,
          page: 1,
          pageSize: REVIEW_COMMENT_PAGE_SIZE,
        });
        setReviewComments(result.items);
        setReviewCommentsPageInfo(result.pageInfo);
      } catch (error) {
        console.error("Failed to load review comments", error);
        const message = extractErrorMessage(error);
        handleAccessError(message);
        setReviewCommentsError("Unable to load review comments.");
      } finally {
        setReviewCommentsLoading(false);
      }
    },
    [extractErrorMessage, handleAccessError]
  );

  const loadComments = useCallback(async () => {
    setCommentLoading(true);
    setCommentError(null);
    try {
      const status = commentStatusFilter === "all" ? undefined : commentStatusFilter;
      const reviewFilter = commentReviewFilter.trim();
      if (reviewFilter) {
        const parsed = z.string().uuid().safeParse(reviewFilter);
        if (!parsed.success) {
          setCommentError("Review ID must be a valid UUID.");
          return;
        }
      }
      const result = await getAdminComments({
        status,
        reviewId: reviewFilter || undefined,
        page: commentPage,
        pageSize: commentPageSize,
      });
      setComments(result.items);
      setCommentPageInfo(result.pageInfo);
      setSelectedCommentIds([]);
    } catch (error) {
      console.error("Failed to load comments", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCommentError("Unable to load comments.");
    } finally {
      setCommentLoading(false);
    }
  }, [
    commentPage,
    commentPageSize,
    commentReviewFilter,
    commentStatusFilter,
    extractErrorMessage,
    handleAccessError,
  ]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    setReportsError(null);
    try {
      const status = reportStatusFilter === "all" ? undefined : reportStatusFilter;
      const result = await getAdminReports({
        status,
        page: reportPage,
        pageSize: reportPageSize,
      });
      setReports(result.items);
      setReportPageInfo(result.pageInfo);
      setSelectedReportIds([]);
    } catch (error) {
      console.error("Failed to load reports", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReportsError("Unable to load reports.");
    } finally {
      setReportsLoading(false);
    }
  }, [
    extractErrorMessage,
    handleAccessError,
    reportPage,
    reportPageSize,
    reportStatusFilter,
  ]);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const result = await getAdminUsers({ page: userPage, pageSize: userPageSize });
      setUsers(result.items);
      setUserPageInfo(result.pageInfo);
      setSelectedUserIds([]);
    } catch (error) {
      console.error("Failed to load users", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setUsersError("Unable to load users.");
    } finally {
      setUsersLoading(false);
    }
  }, [extractErrorMessage, handleAccessError, userPage, userPageSize]);

  const loadUserDetail = useCallback(
    async (userId: string) => {
      setUserDetailLoading(true);
      setUserDetailError(null);
      try {
        const detail = await getAdminUserDetail(userId);
        setUserDetail(detail);
        setUserRoleEdit(detail.role);
        setUserEdit({
          username: detail.username,
          bio: detail.bio ?? "",
          profilePicUrl: detail.profilePicUrl ?? "",
        });
      } catch (error) {
        console.error("Failed to load user detail", error);
        const message = extractErrorMessage(error);
        handleAccessError(message);
        setUserDetailError("Unable to load user details.");
      } finally {
        setUserDetailLoading(false);
      }
    },
    [extractErrorMessage, handleAccessError]
  );

  const loadReportTargetDetail = useCallback(
    async (report: AdminReport) => {
      setReportTargetLoading(true);
      setReportTargetError(null);
      try {
        if (report.targetType === "review") {
          const detail = await getAdminReviewDetail(report.targetId);
          setReportTargetReviewDetail(detail);
          setReportTargetUserDetail(null);
        } else if (report.targetType === "user") {
          const detail = await getAdminUserDetail(report.targetId);
          setReportTargetUserDetail(detail);
          setReportTargetReviewDetail(null);
        } else {
          setReportTargetReviewDetail(null);
          setReportTargetUserDetail(null);
        }
      } catch (error) {
        console.error("Failed to load report target detail", error);
        const message = extractErrorMessage(error);
        handleAccessError(message);
        setReportTargetError("Unable to load target details.");
        setReportTargetReviewDetail(null);
        setReportTargetUserDetail(null);
      } finally {
        setReportTargetLoading(false);
      }
    },
    [extractErrorMessage, handleAccessError]
  );

  const refreshAll = () => {
    loadCategories();
    loadReviews();
    loadComments();
    loadReports();
    loadUsers();
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMessage(null);
      const ok = await ensureAdminSession();
      setLoading(false);
      if (!ok) {
        return;
      }
      setReady(true);
    };

    init();
  }, [ensureAdminSession]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    loadCategories();
  }, [loadCategories, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    loadReviews();
  }, [loadReviews, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    loadComments();
  }, [loadComments, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    loadReports();
  }, [loadReports, ready]);

  useEffect(() => {
    if (!ready) {
      return;
    }
    loadUsers();
  }, [loadUsers, ready]);

  useEffect(() => {
    if (!activeReviewId) {
      setReviewDetail(null);
      setReviewEdit(null);
      setReviewComments([]);
      setReviewCommentsPageInfo(null);
      setReviewCommentsError(null);
      return;
    }
    loadReviewDetail(activeReviewId);
    loadReviewComments(activeReviewId);
  }, [activeReviewId, loadReviewComments, loadReviewDetail]);

  useEffect(() => {
    if (!activeCommentId) {
      setCommentDetail(null);
      setCommentEditText("");
      return;
    }
    const detail = comments.find((comment) => comment.id === activeCommentId) ?? null;
    setCommentDetail(detail);
    setCommentEditText(detail?.text ?? "");
    setCommentStatusEdit(detail?.status ?? "published");
  }, [activeCommentId, comments]);

  useEffect(() => {
    if (!activeUserId) {
      setUserDetail(null);
      setUserEdit(null);
      return;
    }
    loadUserDetail(activeUserId);
  }, [activeUserId, loadUserDetail]);

  useEffect(() => {
    if (!activeReport) {
      setReportTargetReviewDetail(null);
      setReportTargetUserDetail(null);
      setReportTargetError(null);
      setReportTargetLoading(false);
      return;
    }
    loadReportTargetDetail(activeReport);
  }, [activeReport, loadReportTargetDetail]);

  const handleCreateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setCategoryMessage(null);
    setCategoryError(null);

    const parentIdValue = newCategoryParentId
      ? Number(newCategoryParentId)
      : null;
    const parsed = createCategorySchema.safeParse({
      name: newCategoryName,
      parentId: parentIdValue,
    });

    if (!parsed.success) {
      setCategoryError(parsed.error.issues[0]?.message ?? "Invalid category.");
      return;
    }

    try {
      await createAdminCategory(parsed.data);
      setNewCategoryName("");
      setNewCategoryParentId("");
      setCategoryMessage("Category created.");
      loadCategories();
    } catch (error) {
      console.error("Failed to create category", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCategoryError("Unable to create category.");
    }
  };

  const handleEditCategorySelect = (value: string) => {
    setEditCategoryId(value);
    const id = Number(value);
    const selected = categoryLookup.get(id);
    if (selected) {
      setEditCategoryName(selected.name);
      setEditCategoryParentId(selected.parentId ? String(selected.parentId) : "");
    } else {
      setEditCategoryName("");
      setEditCategoryParentId("");
    }
  };

  const handleUpdateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setCategoryMessage(null);
    setCategoryError(null);

    const id = Number(editCategoryId);
    if (!id) {
      setCategoryError("Select a category to update.");
      return;
    }

    const parentIdValue = editCategoryParentId
      ? Number(editCategoryParentId)
      : null;
    if (parentIdValue === id) {
      setCategoryError("A category cannot be its own parent.");
      return;
    }

    const parsed = updateCategorySchema.safeParse({
      name: editCategoryName,
      parentId: parentIdValue,
    });

    if (!parsed.success) {
      setCategoryError(parsed.error.issues[0]?.message ?? "Invalid category.");
      return;
    }

    try {
      await updateAdminCategory(id, parsed.data);
      setCategoryMessage("Category updated.");
      loadCategories();
    } catch (error) {
      console.error("Failed to update category", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCategoryError("Unable to update category.");
    }
  };

  const handleReviewSelect = (reviewId: string) => {
    setActiveReviewId(reviewId);
    setReviewDetailError(null);
  };

  const handleReviewStatusSave = async () => {
    if (!reviewDetail) {
      return;
    }
    if (reviewStatusEdit === "deleted") {
      const ok = window.confirm("Delete this review?");
      if (!ok) {
        return;
      }
    }
    setReviewError(null);
    try {
      const updated = await updateAdminReviewStatus(reviewDetail.id, reviewStatusEdit);
      setReviewDetail({ ...reviewDetail, status: updated.status });
      setReviews((current) =>
        current.map((item) =>
          item.id === reviewDetail.id
            ? { ...item, status: updated.status }
            : item
        )
      );
      if (reviewStatusFilter !== "all" && reviewStatusFilter !== updated.status) {
        setReviews((current) => current.filter((item) => item.id !== reviewDetail.id));
        setReviewPageInfo((prev) => updatePaginationTotal(prev, -1));
      }
      setReviewMessage("Review status updated.");
    } catch (error) {
      console.error("Failed to update review status", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReviewError("Unable to update review status.");
    }
  };

  const handleReviewSave = async () => {
    if (!reviewDetail || !reviewEdit) {
      return;
    }
    setReviewDetailError(null);
    const photoUrls = reviewEdit.photoUrls
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = reviewEditSchema.safeParse({
      title: reviewEdit.title,
      excerpt: reviewEdit.excerpt,
      contentHtml: reviewEdit.contentHtml,
      photoUrls,
      categoryId: Number(reviewEdit.categoryId),
      subCategoryId: reviewEdit.subCategoryId
        ? Number(reviewEdit.subCategoryId)
        : null,
    });

    if (!parsed.success) {
      setReviewDetailError(parsed.error.issues[0]?.message ?? "Invalid review data.");
      return;
    }

    const subcategories = subcategoriesByParent.get(parsed.data.categoryId) ?? [];
    if (
      parsed.data.subCategoryId &&
      !subcategories.some((subcategory) => subcategory.id === parsed.data.subCategoryId)
    ) {
      setReviewDetailError("Subcategory does not match the selected category.");
      return;
    }

    try {
      const updated = await updateAdminReview(reviewDetail.id, {
        title: parsed.data.title,
        excerpt: parsed.data.excerpt,
        contentHtml: parsed.data.contentHtml,
        photoUrls: parsed.data.photoUrls,
        categoryId: parsed.data.categoryId,
        subCategoryId: parsed.data.subCategoryId ?? null,
      });
      setReviewDetail(updated);
      setReviews((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setReviewMessage("Review content updated.");
    } catch (error) {
      console.error("Failed to update review", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReviewDetailError("Unable to update review content.");
    }
  };

  const handleReviewCommentsOpen = () => {
    if (!reviewDetail) {
      return;
    }
    setCommentReviewFilter(reviewDetail.id);
    setCommentStatusFilter("all");
    setCommentPage(1);
    setCommentQuery("");
    setActiveCommentId(null);
    setActiveTab("comments");
  };

  const handleBulkReviewStatus = async () => {
    if (selectedReviewIds.length === 0) {
      return;
    }
    if (reviewBulkStatus === "deleted") {
      const ok = window.confirm("Delete selected reviews?");
      if (!ok) {
        return;
      }
    }
    setReviewError(null);
    try {
      const result = await bulkUpdateAdminReviewStatus(
        selectedReviewIds,
        reviewBulkStatus
      );
      await loadReviews();
      const successCount = result.succeeded.length;
      const failureCount = result.failed.length;
      if (failureCount > 0) {
        setReviewError(`Updated ${successCount} reviews. ${failureCount} failed.`);
      } else {
        setReviewMessage(`Updated ${successCount} reviews.`);
      }
    } catch (error) {
      console.error("Failed to bulk update reviews", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReviewError("Unable to update selected reviews.");
    }
  };

  const handleCommentSelect = (commentId: string) => {
    setActiveCommentId(commentId);
  };

  const handleCommentSave = async () => {
    if (!commentDetail) {
      return;
    }
    const parsed = commentEditSchema.safeParse({ text: commentEditText });
    if (!parsed.success) {
      setCommentError(parsed.error.issues[0]?.message ?? "Invalid comment text.");
      return;
    }
    setCommentError(null);
    try {
      const updated = await updateAdminComment(commentDetail.id, parsed.data);
      setCommentDetail(updated);
      setComments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item))
      );
      setCommentMessage("Comment updated.");
    } catch (error) {
      console.error("Failed to update comment", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCommentError("Unable to update comment.");
    }
  };

  const handleCommentStatusSave = async () => {
    if (!commentDetail) {
      return;
    }
    if (commentStatusEdit === "deleted") {
      const ok = window.confirm("Delete this comment?");
      if (!ok) {
        return;
      }
    }
    setCommentError(null);
    try {
      const updated = await updateAdminCommentStatus(commentDetail.id, commentStatusEdit);
      setCommentDetail({ ...commentDetail, status: updated.status });
      setComments((current) =>
        current.map((item) =>
          item.id === commentDetail.id
            ? { ...item, status: updated.status }
            : item
        )
      );
      if (commentStatusFilter !== "all" && commentStatusFilter !== updated.status) {
        setComments((current) => current.filter((item) => item.id !== commentDetail.id));
        setCommentPageInfo((prev) => updatePaginationTotal(prev, -1));
      }
      setCommentMessage("Comment status updated.");
    } catch (error) {
      console.error("Failed to update comment status", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCommentError("Unable to update comment status.");
    }
  };

  const handleBulkCommentStatus = async () => {
    if (selectedCommentIds.length === 0) {
      return;
    }
    if (commentBulkStatus === "deleted") {
      const ok = window.confirm("Delete selected comments?");
      if (!ok) {
        return;
      }
    }
    setCommentError(null);
    try {
      const result = await bulkUpdateAdminCommentStatus(
        selectedCommentIds,
        commentBulkStatus
      );
      await loadComments();
      const successCount = result.succeeded.length;
      const failureCount = result.failed.length;
      if (failureCount > 0) {
        setCommentError(`Updated ${successCount} comments. ${failureCount} failed.`);
      } else {
        setCommentMessage(`Updated ${successCount} comments.`);
      }
    } catch (error) {
      console.error("Failed to bulk update comments", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setCommentError("Unable to update selected comments.");
    }
  };

  const handleReportSelect = (reportId: string) => {
    setActiveReportId(reportId);
  };

  const handleReportStatusUpdate = async (reportId: string, status: ReportStatus) => {
    setReportsError(null);
    try {
      const updated = await updateAdminReportStatus(reportId, status);
      setReports((current) =>
        current.map((report) =>
          report.id === reportId
            ? { ...report, ...updated, target: report.target }
            : report
        )
      );
      if (reportStatusFilter !== "all" && updated.status !== reportStatusFilter) {
        setReports((current) => current.filter((report) => report.id !== reportId));
        setReportPageInfo((prev) => updatePaginationTotal(prev, -1));
      }
      setReportsMessage("Report status updated.");
    } catch (error) {
      console.error("Failed to update report status", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReportsError("Unable to update report status.");
    }
  };

  const handleBulkReportStatus = async () => {
    if (selectedReportIds.length === 0) {
      return;
    }
    setReportsError(null);
    try {
      const result = await bulkUpdateAdminReportStatus(
        selectedReportIds,
        reportBulkStatus
      );
      await loadReports();
      const successCount = result.succeeded.length;
      const failureCount = result.failed.length;
      if (failureCount > 0) {
        setReportsError(`Updated ${successCount} reports. ${failureCount} failed.`);
      } else {
        setReportsMessage(`Updated ${successCount} reports.`);
      }
    } catch (error) {
      console.error("Failed to bulk update reports", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReportsError("Unable to update selected reports.");
    }
  };

  const handleReportTargetReviewStatus = async (
    report: AdminReport,
    status: ReviewStatus
  ) => {
    if (status === "deleted") {
      const ok = window.confirm("Delete this review?");
      if (!ok) {
        return;
      }
    }
    setReportsError(null);
    try {
      await updateAdminReviewStatus(report.targetId, status);
      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                target: item.target?.review
                  ? {
                      ...item.target,
                      review: { ...item.target.review, status },
                    }
                  : item.target,
              }
            : item
        )
      );
      setReportTargetReviewDetail((current) =>
        current ? { ...current, status } : current
      );
      setReportsMessage("Target review updated.");
    } catch (error) {
      console.error("Failed to update review from report", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReportsError("Unable to update review status.");
    }
  };

  const handleReportTargetCommentStatus = async (
    report: AdminReport,
    status: CommentStatus
  ) => {
    if (status === "deleted") {
      const ok = window.confirm("Delete this comment?");
      if (!ok) {
        return;
      }
    }
    setReportsError(null);
    try {
      await updateAdminCommentStatus(report.targetId, status);
      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                target: item.target?.comment
                  ? {
                      ...item.target,
                      comment: { ...item.target.comment, status },
                    }
                  : item.target,
              }
            : item
        )
      );
      setReportsMessage("Target comment updated.");
    } catch (error) {
      console.error("Failed to update comment from report", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReportsError("Unable to update comment status.");
    }
  };

  const handleReportTargetUserRole = async (userId: string, role: UserRole) => {
    setReportsError(null);
    try {
      await updateAdminUserRole(userId, role);
      setReports((current) =>
        current.map((item) =>
          item.target?.user?.userId === userId
            ? {
                ...item,
                target: item.target?.user
                  ? {
                      ...item.target,
                      user: { ...item.target.user, role },
                    }
                  : item.target,
              }
            : item
        )
      );
      setReportTargetUserDetail((current) =>
        current ? { ...current, role } : current
      );
      setReportsMessage("Target user role updated.");
    } catch (error) {
      console.error("Failed to update user role from report", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setReportsError("Unable to update user role.");
    }
  };

  const handleUserSelect = (userId: string) => {
    setActiveUserId(userId);
    setUserDetailError(null);
  };

  const handleUserProfileSave = async () => {
    if (!userDetail || !userEdit) {
      return;
    }
    const parsed = userUpdateSchema.safeParse({
      username: userEdit.username,
      bio: userEdit.bio ? userEdit.bio : null,
      profilePicUrl: userEdit.profilePicUrl ? userEdit.profilePicUrl : null,
    });

    if (!parsed.success) {
      setUserDetailError(parsed.error.issues[0]?.message ?? "Invalid user data.");
      return;
    }

    setUserDetailError(null);
    try {
      const updated = await updateAdminUserProfile(userDetail.userId, parsed.data);
      setUserDetail(updated);
      setUsers((current) =>
        current.map((item) =>
          item.userId === updated.userId ? { ...item, username: updated.username } : item
        )
      );
      setUsersMessage("User profile updated.");
    } catch (error) {
      console.error("Failed to update user profile", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setUserDetailError("Unable to update user profile.");
    }
  };

  const handleUserRoleSave = async () => {
    if (!userDetail) {
      return;
    }
    setUsersError(null);
    try {
      const updated = await updateAdminUserRole(userDetail.userId, userRoleEdit);
      setUserDetail({ ...userDetail, role: updated.role });
      setUsers((current) =>
        current.map((user) =>
          user.userId === updated.userId ? { ...user, role: updated.role } : user
        )
      );
      setUsersMessage("User role updated.");
    } catch (error) {
      console.error("Failed to update user role", error);
      const message = extractErrorMessage(error);
      handleAccessError(message);
      setUsersError("Unable to update user role.");
    }
  };

  const categoryCount = categoryPageInfo?.totalItems ?? categories.length;
  const reviewTotal = reviewPageInfo?.totalItems ?? reviews.length;
  const commentTotal = commentPageInfo?.totalItems ?? comments.length;
  const reportTotal = reportPageInfo?.totalItems ?? reports.length;
  const userTotal = userPageInfo?.totalItems ?? users.length;
  const reviewCommentTotal =
    reviewCommentsPageInfo?.totalItems ?? reviewComments.length;
  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col gap-4 mb-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                Admin Control Center
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Monitor, edit, and moderate every piece of content with confidence.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                onClick={refreshAll}
                disabled={loading}
              >
                Refresh all
              </button>
              <div className="rounded-lg bg-slate-100 dark:bg-slate-900 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {formatRelativeTime(new Date().toISOString())}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Reviews ({reviewFilterLabel})</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCompactNumber(reviewTotal)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active moderation queue</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Comments ({commentFilterLabel})</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCompactNumber(commentTotal)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Community engagement</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Reports ({reportFilterLabel})</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCompactNumber(reportTotal)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Risk and safety alerts</p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">Users</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCompactNumber(userTotal)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Active profiles</p>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
            Loading admin workspace...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
            <aside className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                Workspaces
              </p>
              <div className="flex flex-col gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      activeTab === tab.key
                        ? "bg-primary text-white"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-xs ${activeTab === tab.key ? "text-white" : "text-slate-400"}`}>
                      {tab.key === "reviews" && formatCompactNumber(reviewTotal)}
                      {tab.key === "comments" && formatCompactNumber(commentTotal)}
                      {tab.key === "reports" && formatCompactNumber(reportTotal)}
                      {tab.key === "users" && formatCompactNumber(userTotal)}
                      {tab.key === "categories" && formatCompactNumber(categoryCount)}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <section className="space-y-6">
              {activeTab === "reviews" ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Review Management
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Full content visibility and editing for every review.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="self-start sm:self-auto rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={loadReviews}
                      disabled={reviewLoading}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-5 mb-4">
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Status filter
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        value={reviewStatusFilter}
                        onChange={(event) => {
                          setReviewStatusFilter(event.target.value as ReviewStatusFilter);
                          setReviewPage(1);
                        }}
                      >
                        {reviewStatusFilters.map((status) => (
                          <option key={status} value={status}>
                            {status === "all" ? "All statuses" : status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Search
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        placeholder="Title, slug, author"
                        value={reviewQuery}
                        onChange={(event) => setReviewQuery(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Page size
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        value={reviewPageSize}
                        onChange={(event) => {
                          setReviewPageSize(Number(event.target.value));
                          setReviewPage(1);
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size} per page
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Results
                      </label>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2">
                        {formatCompactNumber(filteredReviews.length)} shown
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Bulk actions
                    </span>
                    <select
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                      value={reviewBulkStatus}
                      onChange={(event) =>
                        setReviewBulkStatus(event.target.value as ReviewStatus)
                      }
                    >
                      {reviewStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          Set {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg bg-primary text-white text-xs font-semibold px-3 py-1 hover:bg-primary-dark"
                      onClick={handleBulkReviewStatus}
                      disabled={selectedReviewIds.length === 0}
                    >
                      Apply to {selectedReviewIds.length} selected
                    </button>
                  </div>

                  {reviewError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                      {reviewError}
                    </div>
                  ) : null}
                  {reviewMessage ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
                      {reviewMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={
                              selectedReviewIds.length === filteredReviews.length &&
                              filteredReviews.length > 0
                            }
                            onChange={() =>
                              setSelectedReviewIds(
                                toggleSelectAll(
                                  selectedReviewIds,
                                  filteredReviews.map((item) => item.id)
                                )
                              )
                            }
                          />
                          Select all
                        </label>
                        <span>{formatCompactNumber(filteredReviews.length)} items</span>
                      </div>

                      {reviewLoading ? (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                          Loading reviews...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredReviews.map((review) => (
                            <button
                              key={review.id}
                              type="button"
                              onClick={() => handleReviewSelect(review.id)}
                              className={`w-full text-left rounded-lg border px-3 py-3 transition ${
                                activeReviewId === review.id
                                  ? "border-primary bg-blue-50/70 dark:bg-blue-950/30"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/60"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 rounded border-slate-300"
                                  checked={selectedReviewIds.includes(review.id)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    setSelectedReviewIds((current) =>
                                      toggleSelection(current, review.id)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        reviewStatusStyles[review.status]
                                      }`}
                                    >
                                      {review.status}
                                    </span>
                                    <span>#{formatId(review.id)}</span>
                                    <span>
                                      {formatRelativeTime(review.createdAt) || "recent"}
                                    </span>
                                  </div>
                                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                                    {review.title}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    @{review.author.username} · {review.slug}
                                  </p>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                                    {review.excerpt}
                                  </p>
                                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                                    <span>
                                      Rating {review.ratingAvg ?? "-"} ({formatNumber(review.ratingCount)})
                                    </span>
                                    <span>
                                      Votes {formatNumber(review.votesUp)} / {formatNumber(review.votesDown)}
                                    </span>
                                    <span>Comments {formatNumber(review.commentCount)}</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          ))}
                          {filteredReviews.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              No reviews found for the current filters.
                            </p>
                          ) : null}
                        </div>
                      )}
                      <PaginationControls
                        pagination={reviewPageInfo}
                        onPageChange={setReviewPage}
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                      {reviewDetailLoading ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Loading review details...
                        </p>
                      ) : reviewDetail ? (
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Review #{formatId(reviewDetail.id)}
                              </p>
                              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                                {reviewDetail.title}
                              </h3>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                @{reviewDetail.author.username} · {reviewDetail.slug}
                              </p>
                            </div>
                            <Link
                              href={localizePath(`/content/${reviewDetail.slug}`, lang)}
                              className="text-xs text-primary hover:underline"
                            >
                              Open
                            </Link>
                          </div>

                          {reviewDetailError ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                              {reviewDetailError}
                            </div>
                          ) : null}

                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Status
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                value={reviewStatusEdit}
                                onChange={(event) =>
                                  setReviewStatusEdit(event.target.value as ReviewStatus)
                                }
                              >
                                {reviewStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="rounded-lg bg-emerald-500 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-600"
                                onClick={handleReviewStatusSave}
                              >
                                Save
                              </button>
                            </div>
                          </div>

                          {reviewEdit ? (
                            <div className="space-y-3">
                              <div className="grid gap-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Title
                                </label>
                                <input
                                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                  value={reviewEdit.title}
                                  onChange={(event) =>
                                    setReviewEdit({
                                      ...reviewEdit,
                                      title: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Excerpt
                                </label>
                                <textarea
                                  className="min-h-[80px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                  value={reviewEdit.excerpt}
                                  onChange={(event) =>
                                    setReviewEdit({
                                      ...reviewEdit,
                                      excerpt: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Content HTML
                                </label>
                                <textarea
                                  className="min-h-[140px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                                  value={reviewEdit.contentHtml}
                                  onChange={(event) =>
                                    setReviewEdit({
                                      ...reviewEdit,
                                      contentHtml: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Photo URLs (one per line)
                                </label>
                                <textarea
                                  className="min-h-[80px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono"
                                  value={reviewEdit.photoUrls}
                                  onChange={(event) =>
                                    setReviewEdit({
                                      ...reviewEdit,
                                      photoUrls: event.target.value,
                                    })
                                  }
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Category
                                </label>
                                <select
                                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                  value={reviewEdit.categoryId}
                                  onChange={(event) =>
                                    setReviewEdit({
                                      ...reviewEdit,
                                      categoryId: event.target.value,
                                      subCategoryId: "",
                                    })
                                  }
                                >
                                  <option value="">Select a category</option>
                                  {topCategories.map((category) => (
                                    <option key={category.id} value={category.id}>
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs text-slate-500 dark:text-slate-400">
                                  Subcategory
                                </label>
                                <select
                                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                  value={reviewEdit.subCategoryId}
                                  onChange={(event) =>
                                    setReviewEdit({
                                      ...reviewEdit,
                                      subCategoryId: event.target.value,
                                    })
                                  }
                                  disabled={!reviewEdit.categoryId}
                                >
                                  <option value="">
                                    {reviewEdit.categoryId
                                      ? "No subcategory"
                                      : "Select a category first"}
                                  </option>
                                  {(reviewEdit.categoryId
                                    ? subcategoriesByParent.get(
                                        Number(reviewEdit.categoryId)
                                      )
                                    : []
                                  )?.map((subcategory) => (
                                    <option key={subcategory.id} value={subcategory.id}>
                                      {subcategory.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button
                                type="button"
                                className="w-full rounded-lg bg-primary text-white text-xs font-semibold py-2 hover:bg-primary-dark"
                                onClick={handleReviewSave}
                              >
                                Save review changes
                              </button>
                            </div>
                          ) : null}

                          {reviewEdit?.contentHtml ? (
                            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                                Content preview
                              </p>
                              <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-48 overflow-auto">
                                {reviewPreviewBlocks.length > 0
                                  ? reviewPreviewBlocks.map((block, index) =>
                                      block.type === "list" ? (
                                        <ul key={`preview-list-${index}`}>
                                          {block.items.map((item, itemIndex) => (
                                            <li key={`preview-item-${index}-${itemIndex}`}>
                                              {item}
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <p key={`preview-paragraph-${index}`}>
                                          {block.lines.map((line, lineIndex) => (
                                            <span
                                              key={`preview-line-${index}-${lineIndex}`}
                                            >
                                              {line}
                                              {lineIndex < block.lines.length - 1 ? (
                                                <br />
                                              ) : null}
                                            </span>
                                          ))}
                                        </p>
                                      )
                                    )
                                  : "No preview text available."}
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                Recent comments ({formatCompactNumber(reviewCommentTotal)})
                              </p>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px] font-semibold"
                                  onClick={() => loadReviewComments(reviewDetail.id)}
                                  disabled={reviewCommentsLoading}
                                >
                                  Refresh
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg bg-primary text-white px-2 py-1 text-[11px] font-semibold hover:bg-primary-dark"
                                  onClick={handleReviewCommentsOpen}
                                >
                                  Open full list
                                </button>
                              </div>
                            </div>
                            {reviewCommentsLoading ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Loading comments...
                              </p>
                            ) : reviewCommentsError ? (
                              <p className="text-xs text-red-600">{reviewCommentsError}</p>
                            ) : reviewComments.length > 0 ? (
                              <div className="space-y-2">
                                {reviewComments.map((comment) => (
                                  <div
                                    key={comment.id}
                                    className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2"
                                  >
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                                      <span
                                        className={`rounded-full px-2 py-0.5 font-semibold ${
                                          commentStatusStyles[comment.status]
                                        }`}
                                      >
                                        {comment.status}
                                      </span>
                                      <span>
                                        {formatRelativeTime(comment.createdAt) || "recent"}
                                      </span>
                                    </div>
                                    <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                                      {comment.text}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                      @{comment.author.username}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                No comments for this review yet.
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select a review to view full content and edit details.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "comments" ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Comment Moderation
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Edit text, adjust status, and keep conversations healthy.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="self-start sm:self-auto rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={loadComments}
                      disabled={commentLoading}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4 mb-4">
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Status filter
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        value={commentStatusFilter}
                        onChange={(event) => {
                          setCommentStatusFilter(event.target.value as CommentStatusFilter);
                          setCommentPage(1);
                        }}
                      >
                        {commentStatusFilters.map((status) => (
                          <option key={status} value={status}>
                            {status === "all" ? "All statuses" : status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Search
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        placeholder="Comment, author, review"
                        value={commentQuery}
                        onChange={(event) => setCommentQuery(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Review ID
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        placeholder="Filter by review UUID"
                        value={commentReviewFilter}
                        onChange={(event) => {
                          setCommentReviewFilter(event.target.value);
                          setCommentPage(1);
                        }}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Page size
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        value={commentPageSize}
                        onChange={(event) => {
                          setCommentPageSize(Number(event.target.value));
                          setCommentPage(1);
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size} per page
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Results
                      </label>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2">
                        {formatCompactNumber(filteredComments.length)} shown
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Bulk actions
                    </span>
                    <select
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                      value={commentBulkStatus}
                      onChange={(event) =>
                        setCommentBulkStatus(event.target.value as CommentStatus)
                      }
                    >
                      {commentStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          Set {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg bg-primary text-white text-xs font-semibold px-3 py-1 hover:bg-primary-dark"
                      onClick={handleBulkCommentStatus}
                      disabled={selectedCommentIds.length === 0}
                    >
                      Apply to {selectedCommentIds.length} selected
                    </button>
                  </div>

                  {commentError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                      {commentError}
                    </div>
                  ) : null}
                  {commentMessage ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
                      {commentMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={
                              selectedCommentIds.length === filteredComments.length &&
                              filteredComments.length > 0
                            }
                            onChange={() =>
                              setSelectedCommentIds(
                                toggleSelectAll(
                                  selectedCommentIds,
                                  filteredComments.map((item) => item.id)
                                )
                              )
                            }
                          />
                          Select all
                        </label>
                        <span>{formatCompactNumber(filteredComments.length)} items</span>
                      </div>

                      {commentLoading ? (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                          Loading comments...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredComments.map((comment) => (
                            <button
                              key={comment.id}
                              type="button"
                              onClick={() => handleCommentSelect(comment.id)}
                              className={`w-full text-left rounded-lg border px-3 py-3 transition ${
                                activeCommentId === comment.id
                                  ? "border-primary bg-blue-50/70 dark:bg-blue-950/30"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/60"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 rounded border-slate-300"
                                  checked={selectedCommentIds.includes(comment.id)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    setSelectedCommentIds((current) =>
                                      toggleSelection(current, comment.id)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        commentStatusStyles[comment.status]
                                      }`}
                                    >
                                      {comment.status}
                                    </span>
                                    <span>#{formatId(comment.id)}</span>
                                    <span>
                                      {formatRelativeTime(comment.createdAt) || "recent"}
                                    </span>
                                  </div>
                                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                                    {comment.text}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                    @{comment.author.username}
                                    {comment.review?.title
                                      ? ` · ${comment.review.title}`
                                      : ""}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                          {filteredComments.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              No comments found for the current filters.
                            </p>
                          ) : null}
                        </div>
                      )}
                      <PaginationControls
                        pagination={commentPageInfo}
                        onPageChange={setCommentPage}
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                      {commentDetail ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Comment #{formatId(commentDetail.id)}
                            </p>
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              @{commentDetail.author.username}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {commentDetail.review?.title ?? "No review title"}
                            </p>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Status
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                value={commentStatusEdit}
                                onChange={(event) =>
                                  setCommentStatusEdit(event.target.value as CommentStatus)
                                }
                              >
                                {commentStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="rounded-lg bg-emerald-500 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-600"
                                onClick={handleCommentStatusSave}
                              >
                                Save
                              </button>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Edit text
                            </label>
                            <textarea
                              className="min-h-[140px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                              value={commentEditText}
                              onChange={(event) => setCommentEditText(event.target.value)}
                            />
                          </div>
                          <button
                            type="button"
                            className="w-full rounded-lg bg-primary text-white text-xs font-semibold py-2 hover:bg-primary-dark"
                            onClick={handleCommentSave}
                          >
                            Save comment
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select a comment to view and edit details.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "reports" ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Reports & Risk
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Resolve reports and apply direct moderation actions.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="self-start sm:self-auto rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={loadReports}
                      disabled={reportsLoading}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4 mb-4">
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Status filter
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        value={reportStatusFilter}
                        onChange={(event) => {
                          setReportStatusFilter(event.target.value as ReportStatusFilter);
                          setReportPage(1);
                        }}
                      >
                        {reportStatusFilters.map((status) => (
                          <option key={status} value={status}>
                            {status === "all" ? "All statuses" : status}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Target filter
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        value={reportTargetFilter}
                        onChange={(event) =>
                          setReportTargetFilter(event.target.value as ReportTargetFilter)
                        }
                      >
                        {reportTargetFilters.map((target) => (
                          <option key={target} value={target}>
                            {target === "all" ? "All targets" : target}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Search
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        placeholder="Reason or target"
                        value={reportQuery}
                        onChange={(event) => setReportQuery(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Page size
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        value={reportPageSize}
                        onChange={(event) => {
                          setReportPageSize(Number(event.target.value));
                          setReportPage(1);
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size} per page
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 mb-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Bulk actions
                    </span>
                    <select
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                      value={reportBulkStatus}
                      onChange={(event) =>
                        setReportBulkStatus(event.target.value as ReportStatus)
                      }
                    >
                      {reportStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          Set {status}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="rounded-lg bg-primary text-white text-xs font-semibold px-3 py-1 hover:bg-primary-dark"
                      onClick={handleBulkReportStatus}
                      disabled={selectedReportIds.length === 0}
                    >
                      Apply to {selectedReportIds.length} selected
                    </button>
                  </div>

                  {reportsError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                      {reportsError}
                    </div>
                  ) : null}
                  {reportsMessage ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
                      {reportsMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={
                              selectedReportIds.length === filteredReports.length &&
                              filteredReports.length > 0
                            }
                            onChange={() =>
                              setSelectedReportIds(
                                toggleSelectAll(
                                  selectedReportIds,
                                  filteredReports.map((item) => item.id)
                                )
                              )
                            }
                          />
                          Select all
                        </label>
                        <span>{formatCompactNumber(filteredReports.length)} items</span>
                      </div>

                      {reportsLoading ? (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                          Loading reports...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredReports.map((report) => (
                            <button
                              key={report.id}
                              type="button"
                              onClick={() => handleReportSelect(report.id)}
                              className={`w-full text-left rounded-lg border px-3 py-3 transition ${
                                activeReportId === report.id
                                  ? "border-primary bg-blue-50/70 dark:bg-blue-950/30"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/60"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 rounded border-slate-300"
                                  checked={selectedReportIds.includes(report.id)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    setSelectedReportIds((current) =>
                                      toggleSelection(current, report.id)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        reportStatusStyles[report.status]
                                      }`}
                                    >
                                      {report.status}
                                    </span>
                                    <span>{report.targetType.toUpperCase()}</span>
                                    <span>#{formatId(report.targetId)}</span>
                                  </div>
                                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                                    {report.reason}
                                  </h3>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {formatRelativeTime(report.createdAt) || "recent"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                          {filteredReports.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              No reports found for the current filters.
                            </p>
                          ) : null}
                        </div>
                      )}
                      <PaginationControls
                        pagination={reportPageInfo}
                        onPageChange={setReportPage}
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                      {activeReport ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Report #{formatId(activeReport.id)}
                            </p>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                              {activeReport.reason}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {activeReport.details ?? "No additional details"}
                            </p>
                          </div>

                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Report status
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                value={activeReport.status}
                                onChange={(event) =>
                                  handleReportStatusUpdate(
                                    activeReport.id,
                                    event.target.value as ReportStatus
                                  )
                                }
                              >
                                {reportStatusOptions.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3">
                            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                              Target details
                            </p>
                            {reportTargetLoading ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                Loading full target details...
                              </p>
                            ) : null}
                            {reportTargetError ? (
                              <p className="text-xs text-red-600 mb-2">{reportTargetError}</p>
                            ) : null}
                            {activeReport.target?.review ? (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  {activeReport.target.review.title}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  @{activeReport.target.review.author?.username ?? "unknown"} · {activeReport.target.review.slug}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      reviewStatusStyles[activeReport.target.review.status]
                                    }`}
                                  >
                                    {activeReport.target.review.status}
                                  </span>
                                  <Link
                                    href={localizePath(`/content/${activeReport.target.review.slug}`, lang)}
                                    className="text-primary hover:underline text-[11px] font-semibold"
                                  >
                                    Open review
                                  </Link>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {reviewStatusOptions.map((status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold"
                                      onClick={() =>
                                        handleReportTargetReviewStatus(activeReport, status)
                                      }
                                    >
                                      Set {status}
                                    </button>
                                  ))}
                                </div>
                                {reportTargetReviewDetail ? (
                                  <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                      Excerpt
                                    </p>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 whitespace-pre-wrap">
                                      {reportTargetReviewDetail.excerpt}
                                    </p>
                                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-3">
                                      Content preview
                                    </p>
                                    <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap max-h-32 overflow-auto mt-1">
                                      {toPlainText(
                                        reportTargetReviewDetail.contentHtml ??
                                          reportTargetReviewDetail.excerpt
                                      ) || "No preview text available."}
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                                      <span>
                                        Rating {reportTargetReviewDetail.ratingAvg ?? "-"} (
                                        {formatNumber(reportTargetReviewDetail.ratingCount)})
                                      </span>
                                      <span>
                                        Votes {formatNumber(reportTargetReviewDetail.votesUp)} /{" "}
                                        {formatNumber(reportTargetReviewDetail.votesDown)}
                                      </span>
                                      <span>
                                        Comments{" "}
                                        {formatNumber(reportTargetReviewDetail.commentCount)}
                                      </span>
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {activeReport.target?.comment ? (
                              <div className="space-y-2">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Comment on {activeReport.target.comment.reviewTitle ?? "review"}
                                </p>
                                <p className="text-sm text-slate-900 dark:text-white">
                                  {activeReport.target.comment.text}
                                </p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      commentStatusStyles[activeReport.target.comment.status]
                                    }`}
                                  >
                                    {activeReport.target.comment.status}
                                  </span>
                                  {activeReport.target.comment.reviewSlug ? (
                                    <Link
                                      href={localizePath(`/content/${activeReport.target.comment.reviewSlug}`, lang)}
                                      className="text-primary hover:underline text-[11px] font-semibold"
                                    >
                                      Open review
                                    </Link>
                                  ) : null}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {commentStatusOptions.map((status) => (
                                    <button
                                      key={status}
                                      type="button"
                                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] font-semibold"
                                      onClick={() =>
                                        handleReportTargetCommentStatus(activeReport, status)
                                      }
                                    >
                                      Set {status}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                            {activeReport.target?.user ? (
                              <div className="space-y-2">
                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                  @{activeReport.target.user.username}
                                </p>
                                <div className="flex items-center gap-2">
                                  <select
                                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                    value={activeReport.target.user.role}
                                    onChange={(event) =>
                                      handleReportTargetUserRole(
                                        activeReport.target?.user?.userId ?? "",
                                        event.target.value as UserRole
                                      )
                                    }
                                  >
                                    {userRoleOptions.map((role) => (
                                      <option key={role} value={role}>
                                        {role}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                {reportTargetUserDetail ? (
                                  <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3">
                                    <div className="flex items-center gap-3">
                                      {reportTargetUserDetail.profilePicUrl ? (
                                        <div
                                          className="size-10 rounded-full bg-center bg-cover"
                                          style={{
                                            backgroundImage: `url(${reportTargetUserDetail.profilePicUrl})`,
                                          }}
                                          aria-label={`${reportTargetUserDetail.username} avatar`}
                                        />
                                      ) : (
                                        <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-800" />
                                      )}
                                      <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                          @{reportTargetUserDetail.username}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                          {reportTargetUserDetail.createdAt
                                            ? `Joined ${formatRelativeTime(
                                                reportTargetUserDetail.createdAt
                                              )}`
                                            : "Join date unknown"}
                                        </p>
                                      </div>
                                    </div>
                                    {reportTargetUserDetail.bio ? (
                                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-wrap">
                                        {reportTargetUserDetail.bio}
                                      </p>
                                    ) : (
                                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                                        No bio available.
                                      </p>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {!activeReport.target?.review &&
                            !activeReport.target?.comment &&
                            !activeReport.target?.user ? (
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Target details not available.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select a report to view full context and actions.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "users" ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        User Management
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Edit profiles, adjust roles, and monitor user health.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="self-start sm:self-auto rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={loadUsers}
                      disabled={usersLoading}
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3 mb-4">
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Search
                      </label>
                      <input
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        placeholder="Username or role"
                        value={userQuery}
                        onChange={(event) => setUserQuery(event.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Page size
                      </label>
                      <select
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                        value={userPageSize}
                        onChange={(event) => {
                          setUserPageSize(Number(event.target.value));
                          setUserPage(1);
                        }}
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <option key={size} value={size}>
                            {size} per page
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Results
                      </label>
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 px-3 py-2">
                        {formatCompactNumber(filteredUsers.length)} shown
                      </div>
                    </div>
                  </div>

                  {usersError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                      {usersError}
                    </div>
                  ) : null}
                  {usersMessage ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
                      {usersMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            className="rounded border-slate-300"
                            checked={
                              selectedUserIds.length === filteredUsers.length &&
                              filteredUsers.length > 0
                            }
                            onChange={() =>
                              setSelectedUserIds(
                                toggleSelectAll(
                                  selectedUserIds,
                                  filteredUsers.map((item) => item.userId)
                                )
                              )
                            }
                          />
                          Select all
                        </label>
                        <span>{formatCompactNumber(filteredUsers.length)} items</span>
                      </div>

                      {usersLoading ? (
                        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 text-sm text-slate-500 dark:text-slate-400">
                          Loading users...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {filteredUsers.map((user) => (
                            <button
                              key={user.userId}
                              type="button"
                              onClick={() => handleUserSelect(user.userId)}
                              className={`w-full text-left rounded-lg border px-3 py-3 transition ${
                                activeUserId === user.userId
                                  ? "border-primary bg-blue-50/70 dark:bg-blue-950/30"
                                  : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-primary/60"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  className="mt-1 rounded border-slate-300"
                                  checked={selectedUserIds.includes(user.userId)}
                                  onChange={(event) => {
                                    event.stopPropagation();
                                    setSelectedUserIds((current) =>
                                      toggleSelection(current, user.userId)
                                    );
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                        userRoleStyles[user.role]
                                      }`}
                                    >
                                      {user.role}
                                    </span>
                                    <span>#{formatId(user.userId)}</span>
                                  </div>
                                  <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">
                                    @{user.username}
                                  </p>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Joined {formatRelativeTime(user.createdAt) || "recent"}
                                  </p>
                                </div>
                              </div>
                            </button>
                          ))}
                          {filteredUsers.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              No users found for the current filters.
                            </p>
                          ) : null}
                        </div>
                      )}
                      <PaginationControls
                        pagination={userPageInfo}
                        onPageChange={setUserPage}
                      />
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4">
                      {userDetailLoading ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Loading user profile...
                        </p>
                      ) : userDetail && userEdit ? (
                        <div className="space-y-4">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              User #{formatId(userDetail.userId)}
                            </p>
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                              @{userDetail.username}
                            </h3>
                          </div>

                          {userDetailError ? (
                            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                              {userDetailError}
                            </div>
                          ) : null}

                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Role
                            </label>
                            <div className="flex items-center gap-2">
                              <select
                                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                                value={userRoleEdit}
                                onChange={(event) =>
                                  setUserRoleEdit(event.target.value as UserRole)
                                }
                              >
                                {userRoleOptions.map((role) => (
                                  <option key={role} value={role}>
                                    {role}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="rounded-lg bg-emerald-500 text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-600"
                                onClick={handleUserRoleSave}
                              >
                                Save
                              </button>
                            </div>
                          </div>

                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Username
                            </label>
                            <input
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                              value={userEdit.username}
                              onChange={(event) =>
                                setUserEdit({ ...userEdit, username: event.target.value })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Bio
                            </label>
                            <textarea
                              className="min-h-[100px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                              value={userEdit.bio}
                              onChange={(event) =>
                                setUserEdit({ ...userEdit, bio: event.target.value })
                              }
                            />
                          </div>
                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500 dark:text-slate-400">
                              Profile picture URL
                            </label>
                            <input
                              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                              value={userEdit.profilePicUrl}
                              onChange={(event) =>
                                setUserEdit({
                                  ...userEdit,
                                  profilePicUrl: event.target.value,
                                })
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="w-full rounded-lg bg-primary text-white text-xs font-semibold py-2 hover:bg-primary-dark"
                            onClick={handleUserProfileSave}
                          >
                            Save profile changes
                          </button>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Select a user to view and edit profile details.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}

              {activeTab === "categories" ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                        Category Management
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Curate navigation, parent-child structure, and discoverability.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="self-start sm:self-auto rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      onClick={loadCategories}
                      disabled={categoryLoading}
                    >
                      Refresh
                    </button>
                  </div>

                  {categoryError ? (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                      {categoryError}
                    </div>
                  ) : null}
                  {categoryMessage ? (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs px-3 py-2">
                      {categoryMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-4 lg:grid-cols-2">
                    <form className="grid gap-3" onSubmit={handleCreateCategory}>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Add Category
                      </h3>
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                          Category name
                        </label>
                        <input
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                          value={newCategoryName}
                          onChange={(event) => setNewCategoryName(event.target.value)}
                          placeholder="e.g. Technology"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                          Parent category (optional)
                        </label>
                        <select
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                          value={newCategoryParentId}
                          onChange={(event) => setNewCategoryParentId(event.target.value)}
                        >
                          <option value="">No parent</option>
                          {topCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="w-full rounded-lg bg-primary text-white text-sm font-bold py-2 hover:bg-primary-dark transition-colors">
                        Create Category
                      </button>
                    </form>

                    <form className="grid gap-3" onSubmit={handleUpdateCategory}>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        Edit Category
                      </h3>
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                          Select category
                        </label>
                        <select
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                          value={editCategoryId}
                          onChange={(event) => handleEditCategorySelect(event.target.value)}
                        >
                          <option value="">Choose a category</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                          Category name
                        </label>
                        <input
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                          value={editCategoryName}
                          onChange={(event) => setEditCategoryName(event.target.value)}
                          placeholder="Category name"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label className="text-xs text-slate-500 dark:text-slate-400">
                          Parent category
                        </label>
                        <select
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                          value={editCategoryParentId}
                          onChange={(event) => setEditCategoryParentId(event.target.value)}
                        >
                          <option value="">No parent</option>
                          {topCategories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm font-bold py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
                        Save Changes
                      </button>
                    </form>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                      Current Categories
                    </h3>
                    <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                      {topCategories.map((category) => (
                        <li key={category.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold">{category.name}</span>
                            <span className="text-xs text-slate-400">#{category.id}</span>
                          </div>
                          {subcategoriesByParent.get(category.id)?.length ? (
                            <ul className="ml-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                              {subcategoriesByParent.get(category.id)?.map((child) => (
                                <li key={child.id} className="flex justify-between">
                                  <span>{child.name}</span>
                                  <span>#{child.id}</span>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </li>
                      ))}
                      {topCategories.length === 0 ? (
                        <li className="text-xs text-slate-400">No categories found yet.</li>
                      ) : null}
                    </ul>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
