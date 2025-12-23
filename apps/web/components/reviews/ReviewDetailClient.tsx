"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { incrementReviewView } from "@/src/lib/api";
import { createComment, voteReview } from "@/src/lib/api-client";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { formatNumber } from "@/src/lib/review-utils";
import { t } from "@/src/lib/copy";

type ReviewDetailClientProps = {
  reviewId: string;
};

export default function ReviewDetailClient({ reviewId }: ReviewDetailClientProps) {
  useEffect(() => {
    const viewStorageKey = `review-viewed-${reviewId}`;
    if (typeof window === "undefined") {
      return;
    }
    const hasViewed = window.sessionStorage.getItem(viewStorageKey);
    if (!hasViewed) {
      incrementReviewView(reviewId)
        .then(() => {
          window.sessionStorage.setItem(viewStorageKey, "1");
        })
        .catch((error) => {
          console.error("Failed to increment review view", error);
        });
    }
  }, [reviewId]);

  return null;
}

type ReviewHelpfulButtonProps = {
  reviewId: string;
  votesUp: number;
};

export function ReviewHelpfulButton({ reviewId, votesUp }: ReviewHelpfulButtonProps) {
  const router = useRouter();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const [isVoting, setIsVoting] = useState(false);

  const requireAuth = useCallback(async () => {
    await ensureAuthLoaded();
    if (!getAccessToken()) {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : localizePath("/catalog", lang);
      const loginPath = localizePath("/user/login", lang);
      router.push(`${loginPath}?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }, [lang, router]);

  const handleVote = async () => {
    if (isVoting || !(await requireAuth())) {
      return;
    }
    setIsVoting(true);
    try {
      await voteReview(reviewId, "up");
      router.refresh();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : t(lang, "reviewDetail.vote.error");
      window.alert(message);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <button
      className="flex items-center gap-2 px-6 py-2 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-primary hover:text-primary transition-all group shadow-sm"
      type="button"
      onClick={handleVote}
      disabled={isVoting}
    >
      <span className="material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform">
        thumb_up
      </span>
      <span className="font-bold">{t(lang, "reviewDetail.helpful.button")} </span>
      <span className="text-slate-400 font-normal">
        ({formatNumber(votesUp, lang)})
      </span>
    </button>
  );
}

type ReviewCommentFormProps = {
  reviewId: string;
  avatarUrl: string;
};

export function ReviewCommentForm({ reviewId, avatarUrl }: ReviewCommentFormProps) {
  const router = useRouter();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const commentSchema = z
    .string()
    .trim()
    .min(1, t(lang, "reviewDetail.comment.validation"));
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requireAuth = useCallback(async () => {
    await ensureAuthLoaded();
    if (!getAccessToken()) {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : localizePath("/catalog", lang);
      const loginPath = localizePath("/user/login", lang);
      router.push(`${loginPath}?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }, [lang, router]);

  const handleSubmit = async () => {
    const parsed = commentSchema.safeParse(commentText);
    if (!parsed.success) {
      window.alert(
        parsed.error.issues[0]?.message ?? t(lang, "reviewDetail.comment.validation")
      );
      return;
    }

    if (isSubmitting || !(await requireAuth())) {
      return;
    }

    setIsSubmitting(true);
    try {
      await createComment(reviewId, parsed.data);
      setCommentText("");
      router.refresh();
    } catch (error) {
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : t(lang, "reviewDetail.comment.error");
      window.alert(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex gap-4 mb-8">
      <div
        className="shrink-0 bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 border border-slate-200 dark:border-slate-600"
        style={{ backgroundImage: `url("${avatarUrl}")` }}
      />
      <div className="flex-1">
        <textarea
          className="w-full p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary focus:outline-none min-h-[100px] text-slate-900 dark:text-white placeholder:text-slate-400"
          placeholder={t(lang, "reviewDetail.comment.placeholder")}
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          disabled={isSubmitting}
        ></textarea>
        <div className="flex justify-end mt-2">
          <button
            className="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t(lang, "reviewDetail.comment.posting")
              : t(lang, "reviewDetail.comment.post")}
          </button>
        </div>
      </div>
    </div>
  );
}
