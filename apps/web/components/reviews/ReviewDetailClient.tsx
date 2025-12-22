"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { incrementReviewView } from "@/src/lib/api";
import { createComment, voteReview } from "@/src/lib/api-client";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";

const commentSchema = z.string().trim().min(1, "Please write a comment.");

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
  const [isVoting, setIsVoting] = useState(false);

  const requireAuth = useCallback(async () => {
    await ensureAuthLoaded();
    if (!getAccessToken()) {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/catalog";
      router.push(`/user/login?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }, [router]);

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
          : "Vote failed.";
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
      <span className="font-bold">Helpful </span>
      <span className="text-slate-400 font-normal">({votesUp})</span>
    </button>
  );
}

type ReviewCommentFormProps = {
  reviewId: string;
  avatarUrl: string;
};

export function ReviewCommentForm({ reviewId, avatarUrl }: ReviewCommentFormProps) {
  const router = useRouter();
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requireAuth = useCallback(async () => {
    await ensureAuthLoaded();
    if (!getAccessToken()) {
      const next =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : "/catalog";
      router.push(`/user/login?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }, [router]);

  const handleSubmit = async () => {
    const parsed = commentSchema.safeParse(commentText);
    if (!parsed.success) {
      window.alert(parsed.error.issues[0]?.message ?? "Please write a comment.");
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
          : "Failed to post comment.";
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
          placeholder="Share your thoughts..."
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
            {isSubmitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}
