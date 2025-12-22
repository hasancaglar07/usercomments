"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createComment, voteReview } from "@/src/lib/api-client";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";

export default function ReviewDetailClient() {
  const router = useRouter();

  useEffect(() => {
    const reviewRoot = document.querySelector<HTMLElement>("[data-review-id]");
    const reviewId = reviewRoot?.dataset.reviewId;
    if (!reviewId) {
      return;
    }

    const voteButtons = Array.from(
      document.querySelectorAll<HTMLButtonElement>("[data-review-vote]")
    );
    const commentButton = document.querySelector<HTMLButtonElement>(
      "[data-comment-submit]"
    );
    const commentInput = document.querySelector<HTMLTextAreaElement>(
      "[data-comment-text]"
    );

    let isVoting = false;
    let isSubmitting = false;

    const requireAuth = async () => {
      await ensureAuthLoaded();
      if (!getAccessToken()) {
        router.push("/user/login");
        return false;
      }
      return true;
    };

    const handleVote = async (event: Event) => {
      event.preventDefault();
      if (isVoting || !(await requireAuth())) {
        return;
      }
      const target = event.currentTarget as HTMLButtonElement | null;
      const voteType = target?.dataset.voteType === "down" ? "down" : "up";
      try {
        isVoting = true;
        await voteReview(reviewId, voteType);
        router.refresh();
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Vote failed.";
        window.alert(message);
      } finally {
        isVoting = false;
      }
    };

    const handleComment = async (event: Event) => {
      event.preventDefault();
      if (isSubmitting || !(await requireAuth())) {
        return;
      }
      const text = commentInput?.value.trim() ?? "";
      if (!text) {
        window.alert("Please write a comment.");
        return;
      }
      try {
        isSubmitting = true;
        await createComment(reviewId, text);
        if (commentInput) {
          commentInput.value = "";
        }
        router.refresh();
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Failed to post comment.";
        window.alert(message);
      } finally {
        isSubmitting = false;
      }
    };

    voteButtons.forEach((button) => {
      button.addEventListener("click", handleVote);
    });
    commentButton?.addEventListener("click", handleComment);

    return () => {
      voteButtons.forEach((button) => {
        button.removeEventListener("click", handleVote);
      });
      commentButton?.removeEventListener("click", handleComment);
    };
  }, [router]);

  return null;
}
