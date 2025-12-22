"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  getProfile,
  presignUpload,
  reportReview,
  updateProfile,
  voteReview,
} from "@/src/lib/api-client";
import { ensureAuthLoaded, getAccessToken, getCurrentUser } from "@/src/lib/auth";
import { FALLBACK_PROFILE_IMAGES } from "@/src/lib/review-utils";

type UserProfileActionsClientProps = {
  username: string;
  displayName: string;
  children: ReactNode;
};

type ToastVariant = "success" | "error" | "info";

type ToastState = {
  message: string;
  variant: ToastVariant;
} | null;

type ReportTarget = {
  reviewId: string;
  reviewSlug: string;
  reviewTitle: string;
};

type UserProfileActionsContextValue = {
  isSelf: boolean;
  isFollowing: boolean;
  followLabel: string;
  followIcon: string;
  onFollowClick: () => void;
  onMessageClick: () => void;
  onMoreClick: () => void;
  onShareProfileClick: () => void;
  onOpenAchievements: () => void;
  onReviewShare: (reviewSlug: string, reviewTitle: string) => void;
  onReviewComment: (reviewSlug: string) => void;
  onReviewVote: (reviewId: string) => void;
  onReviewReport: (target: ReportTarget) => void;
};

const UserProfileActionsContext = createContext<UserProfileActionsContextValue | null>(
  null
);

export function useUserProfileActions() {
  const context = useContext(UserProfileActionsContext);
  if (!context) {
    throw new Error(
      "useUserProfileActions must be used within UserProfileActionsClient"
    );
  }
  return context;
}

const reportSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Report reason is too short.")
    .max(200, "Report reason is too long."),
  details: z
    .string()
    .trim()
    .max(1000, "Details are too long.")
    .optional()
    .or(z.literal("")),
});

const messageSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Subject is too short.")
    .max(120, "Subject is too long."),
  body: z
    .string()
    .trim()
    .min(10, "Message is too short.")
    .max(1000, "Message is too long."),
});

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username is too short.")
    .max(24, "Username is too long.")
    .regex(/^[a-z0-9_-]+$/i, "Use only letters, numbers, - or _."),
  bio: z.string().trim().max(280, "Bio is too long.").optional(),
  profilePicUrl: z.string().url().optional().nullable(),
});

const SUPPORT_EMAIL = "support@irecommend.clone";

export default function UserProfileActionsClient({
  username,
  displayName,
  children,
}: UserProfileActionsClientProps) {
  const router = useRouter();
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageForm, setMessageForm] = useState({ subject: "", body: "" });
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSubmitting, setMessageSubmitting] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportForm, setReportForm] = useState({ reason: "", details: "" });
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    bio: "",
    profilePicUrl: "",
  });
  const [selfProfile, setSelfProfile] = useState<{
    username?: string;
    bio?: string | null;
    profilePicUrl?: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSelf, setIsSelf] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const achievements = useMemo(
    () => [
      {
        title: "Gold Reviewer",
        description: "250+ reviews completed.",
      },
      {
        title: "Consistent Writer",
        description: "Shared new content every week.",
      },
      {
        title: "Helpful Hero",
        description: "Earned 100+ helpful votes.",
      },
      {
        title: "+5 more",
        description: "Show more achievement badges.",
      },
    ],
    []
  );

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info") => {
      setToast({ message, variant });
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => {
        setToast(null);
      }, 3200);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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

  const buildProfileUrl = useCallback(() => {
    const path = `/users/${encodeURIComponent(username)}`;
    if (typeof window === "undefined") {
      return path;
    }
    return new URL(path, window.location.origin).toString();
  }, [username]);

  const shareLink = useCallback(
    async (url: string, title: string) => {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({ title, url });
          showToast("Shared successfully.", "success");
          return;
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "name" in error &&
            String(error.name) === "AbortError"
          ) {
            return;
          }
        }
      }

      if (typeof navigator !== "undefined" && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(url);
          showToast("Link copied.", "success");
          return;
        } catch (error) {
          console.error("Failed to copy link", error);
        }
      }

      showToast("Link could not be copied.", "error");
    },
    [showToast]
  );

  const loadProfileForm = useCallback(async () => {
    setEditError(null);
    setEditLoading(true);
    try {
      const profile = await getProfile();
      setSelfProfile(profile);
      setEditForm({
        username: profile.username ?? username,
        bio: profile.bio ?? "",
        profilePicUrl: profile.profilePicUrl ?? "",
      });
    } catch (error) {
      console.error("Failed to load profile details", error);
      setEditError("Profile details could not be loaded.");
    } finally {
      setEditLoading(false);
    }
  }, [username]);

  const openEditModal = useCallback(async () => {
    const allowed = await requireAuth();
    if (!allowed) {
      return;
    }
    setEditError(null);
    setEditOpen(true);
    if (selfProfile?.username) {
      setEditForm({
        username: selfProfile.username ?? username,
        bio: selfProfile.bio ?? "",
        profilePicUrl: selfProfile.profilePicUrl ?? "",
      });
      return;
    }
    await loadProfileForm();
  }, [loadProfileForm, requireAuth, selfProfile, username]);

  const closeEditModal = useCallback(() => {
    setEditOpen(false);
    setEditError(null);
  }, []);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const allowed = await requireAuth();
    if (!allowed) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setEditError("Please upload an image file.");
      return;
    }

    setEditUploading(true);
    setEditError(null);
    try {
      const presign = await presignUpload({
        filename: file.name,
        contentType: file.type,
      });
      const uploadResponse = await fetch(presign.uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Upload failed.");
      }

      setEditForm((current) => ({
        ...current,
        profilePicUrl: presign.publicUrl,
      }));
      showToast("Profile photo uploaded.", "success");
    } catch (error) {
      console.error("Failed to upload avatar", error);
      setEditError("Photo could not be uploaded.");
    } finally {
      setEditUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const syncFollowState = async () => {
      if (typeof window === "undefined") {
        return;
      }
      try {
        await ensureAuthLoaded();
      } catch {
        // ignore auth init errors
      }
      if (!isMounted) {
        return;
      }
      if (isSelf) {
        setIsFollowing(false);
        return;
      }
      const user = getCurrentUser();
      if (!user) {
        setIsFollowing(false);
        return;
      }
      const viewerKey = user.id || user.email || "viewer";
      const key = `follow:${viewerKey}:${username.toLowerCase()}`;
      let stored = false;
      try {
        stored = window.localStorage.getItem(key) === "1";
      } catch {
        stored = false;
      }
      if (isMounted) {
        setIsFollowing(stored);
      }
    };

    syncFollowState();

    return () => {
      isMounted = false;
    };
  }, [isSelf, username]);

  const handleFollowClick = useCallback(async () => {
    const allowed = await requireAuth();
    if (!allowed || typeof window === "undefined") {
      return;
    }
    if (isSelf) {
      openEditModal();
      return;
    }
    const user = getCurrentUser();
    if (!user) {
      return;
    }
    const viewerKey = user.id || user.email || "viewer";
    const key = `follow:${viewerKey}:${username.toLowerCase()}`;
    const nextState = !isFollowing;
    try {
      if (nextState) {
        window.localStorage.setItem(key, "1");
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore storage errors
    }
    setIsFollowing(nextState);
    showToast(nextState ? "Followed." : "Unfollowed.", "success");
  }, [isFollowing, isSelf, openEditModal, requireAuth, showToast, username]);

  const handleMessageClick = useCallback(async () => {
    if (isSelf) {
      showToast(
        "This is your profile. Use Edit Profile to make changes.",
        "info"
      );
      return;
    }
    const allowed = await requireAuth();
    if (!allowed) {
      return;
    }
    setMessageError(null);
    setMessageForm({
      subject: `Message for ${displayName}`,
      body: "",
    });
    setMessageOpen(true);
  }, [displayName, isSelf, requireAuth, showToast]);

  const handleProfileShare = useCallback(async () => {
    const url = buildProfileUrl();
    await shareLink(url, `${displayName} profile`);
  }, [buildProfileUrl, displayName, shareLink]);

  const handleReviewShare = useCallback(
    async (reviewSlug: string, reviewTitle: string) => {
      const path = `/content/${encodeURIComponent(reviewSlug)}`;
      const url =
        typeof window !== "undefined"
          ? new URL(path, window.location.origin).toString()
          : path;
      await shareLink(url, reviewTitle);
    },
    [shareLink]
  );

  const handleReviewComment = useCallback(
    (reviewSlug: string) => {
      const path = `/content/${encodeURIComponent(reviewSlug)}`;
      router.push(path);
    },
    [router]
  );

  const handleReviewVote = useCallback(
    async (reviewId: string) => {
      const allowed = await requireAuth();
      if (!allowed) {
        return;
      }
      try {
        await voteReview(reviewId, "up");
        showToast("Vote recorded.", "success");
        router.refresh();
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Vote could not be recorded.";
        showToast(message, "error");
      }
    },
    [requireAuth, router, showToast]
  );

  const handleReviewReport = useCallback((target: ReportTarget) => {
    setReportError(null);
    setReportForm({ reason: "", details: "" });
    setReportTarget(target);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const resolveSelf = async () => {
      await ensureAuthLoaded();
      if (!getAccessToken()) {
        if (isMounted) {
          setIsSelf(false);
        }
        return;
      }

      const user = getCurrentUser();
      const metaUsername =
        typeof user?.user_metadata?.username === "string"
          ? user.user_metadata.username
          : user?.email?.split("@")[0];
      let isOwner =
        typeof metaUsername === "string" &&
        metaUsername.toLowerCase() === username.toLowerCase();

      if (!isOwner) {
        try {
          const profile = await getProfile();
          if (profile?.username) {
            isOwner =
              profile.username.toLowerCase() === username.toLowerCase();
          }
          if (isMounted && profile) {
            setSelfProfile(profile);
          }
        } catch (error) {
          console.error("Failed to resolve profile owner", error);
        }
      }

      if (isMounted) {
        setIsSelf(isOwner);
      }
    };

    resolveSelf();
    return () => {
      isMounted = false;
    };
  }, [username]);

  useEffect(() => {
    const modalOpen =
      messageOpen || Boolean(reportTarget) || achievementsOpen || editOpen;
    if (!modalOpen || typeof document === "undefined") {
      return;
    }
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [achievementsOpen, editOpen, messageOpen, reportTarget]);

  useEffect(() => {
    const modalOpen =
      messageOpen || Boolean(reportTarget) || achievementsOpen || editOpen;
    if (!modalOpen || typeof window === "undefined") {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (reportTarget) {
        setReportTarget(null);
        return;
      }
      if (messageOpen) {
        setMessageOpen(false);
        return;
      }
      if (editOpen) {
        closeEditModal();
        return;
      }
      if (achievementsOpen) {
        setAchievementsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
    };
  }, [achievementsOpen, closeEditModal, editOpen, messageOpen, reportTarget]);

  const handleMessageSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessageError(null);
    const parsed = messageSchema.safeParse(messageForm);
    if (!parsed.success) {
      setMessageError(parsed.error.issues[0]?.message ?? "Message is invalid.");
      return;
    }
    setMessageSubmitting(true);
    try {
      const profileUrl = buildProfileUrl();
      const subject = `${parsed.data.subject} (to ${displayName})`;
      const body = `Recipient: ${displayName} (@${username})\n\n${parsed.data.body}\n\nProfile: ${profileUrl}`;
      if (typeof window !== "undefined") {
        const mailto = new URL(`mailto:${SUPPORT_EMAIL}`);
        mailto.searchParams.set("subject", subject);
        mailto.searchParams.set("body", body);
        window.location.href = mailto.toString();
      }
      showToast("Your email client was opened.", "success");
      setMessageOpen(false);
    } catch (error) {
      console.error("Failed to open mail client", error);
      setMessageError("Message could not be sent.");
    } finally {
      setMessageSubmitting(false);
    }
  };

  const handleReportSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!reportTarget) {
      return;
    }
    setReportError(null);
    const parsed = reportSchema.safeParse(reportForm);
    if (!parsed.success) {
      setReportError(parsed.error.issues[0]?.message ?? "Report is invalid.");
      return;
    }
    const allowed = await requireAuth();
    if (!allowed) {
      return;
    }
    setReportSubmitting(true);
    try {
      const payload = {
        reason: parsed.data.reason,
        details: parsed.data.details?.trim() || undefined,
      };
      await reportReview(reportTarget.reviewId, payload);
      showToast("Report submitted.", "success");
      setReportTarget(null);
    } catch (error) {
      console.error("Failed to report review", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Report could not be submitted.";
      setReportError(message);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setEditError(null);
    const allowed = await requireAuth();
    if (!allowed) {
      return;
    }
    const parsed = profileSchema.safeParse({
      username: editForm.username,
      bio: editForm.bio,
      profilePicUrl: editForm.profilePicUrl || null,
    });

    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "Profile data is invalid.");
      return;
    }

    setEditSaving(true);
    try {
      const updated = await updateProfile({
        username: parsed.data.username,
        bio: parsed.data.bio?.trim() ? parsed.data.bio.trim() : null,
        profilePicUrl: parsed.data.profilePicUrl ?? null,
      });
      setSelfProfile(updated);
      showToast("Profile updated.", "success");
      closeEditModal();
      if (
        updated.username &&
        updated.username.toLowerCase() !== username.toLowerCase()
      ) {
        router.push(`/users/${encodeURIComponent(updated.username)}`);
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update profile", error);
      const message =
        error && typeof error === "object" && "message" in error
          ? String(error.message)
          : "Profile could not be updated.";
      setEditError(message);
    } finally {
      setEditSaving(false);
    }
  };

  const followLabel = isSelf
    ? "Edit Profile"
    : isFollowing
      ? "Following"
      : "Follow";
  const followIcon = isSelf
    ? "edit"
    : isFollowing
      ? "person_check"
      : "person_add";

  const contextValue = useMemo(
    () => ({
      isSelf,
      isFollowing,
      followLabel,
      followIcon,
      onFollowClick: handleFollowClick,
      onMessageClick: handleMessageClick,
      onMoreClick: handleProfileShare,
      onShareProfileClick: handleProfileShare,
      onOpenAchievements: () => setAchievementsOpen(true),
      onReviewShare: handleReviewShare,
      onReviewComment: handleReviewComment,
      onReviewVote: handleReviewVote,
      onReviewReport: handleReviewReport,
    }),
    [
      followIcon,
      followLabel,
      handleFollowClick,
      handleMessageClick,
      handleProfileShare,
      handleReviewComment,
      handleReviewReport,
      handleReviewShare,
      handleReviewVote,
      isFollowing,
      isSelf,
    ]
  );

  const avatarPreview =
    editForm.profilePicUrl ||
    selfProfile?.profilePicUrl ||
    FALLBACK_PROFILE_IMAGES[0] ||
    "";

  return (
    <UserProfileActionsContext.Provider value={contextValue}>
      <div
        className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col font-display transition-colors duration-200"
        data-page="user-profile"
      >
        {toast ? (
          <div
            className={`fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.variant === "success"
                ? "bg-emerald-600 text-white"
                : toast.variant === "error"
                  ? "bg-red-600 text-white"
                  : "bg-slate-900 text-white"
            }`}
            role="status"
          >
            {toast.message}
          </div>
        ) : null}

        {messageOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMessageOpen(false)}
            />
            <div
              className="relative w-full max-w-lg rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                  Send message
                </h3>
                <button
                  className="text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark"
                  type="button"
                  onClick={() => setMessageOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>
              <form className="flex flex-col gap-4" onSubmit={handleMessageSubmit}>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">
                    Subject
                  </span>
                  <input
                    className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                    value={messageForm.subject}
                    onChange={(event) =>
                      setMessageForm((current) => ({
                        ...current,
                        subject: event.target.value,
                      }))
                    }
                    placeholder={`Message for ${displayName}`}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">
                    Message
                  </span>
                  <textarea
                    className="w-full min-h-[140px] rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                    value={messageForm.body}
                    onChange={(event) =>
                      setMessageForm((current) => ({
                        ...current,
                        body: event.target.value,
                      }))
                    }
                    placeholder="Write your message..."
                  />
                </label>
                {messageError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                    {messageError}
                  </div>
                ) : null}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    className="rounded-lg border border-border-light dark:border-border-dark px-4 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark hover:bg-background-light dark:hover:bg-background-dark"
                    type="button"
                    onClick={() => setMessageOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70"
                    type="submit"
                    disabled={messageSubmitting}
                  >
                    {messageSubmitting ? "Sending..." : "Send"}
                  </button>
                </div>
                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                  This will open your email client to send the message.
                </p>
              </form>
            </div>
          </div>
        ) : null}

        {editOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={closeEditModal}
            />
            <div
              className="relative w-full max-w-xl rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                    Edit profile
                  </h3>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    Update your public profile details.
                  </p>
                </div>
                <button
                  className="text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark"
                  type="button"
                  onClick={closeEditModal}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>

              {editLoading ? (
                <div className="rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark p-4 text-sm text-text-sub-light dark:text-text-sub-dark">
                  Loading profile details...
                </div>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={handleEditSubmit}>
                  <div className="flex items-center gap-4">
                    <div
                      className="w-16 h-16 rounded-full bg-cover bg-center ring-2 ring-background-light dark:ring-background-dark"
                      style={{ backgroundImage: `url(${avatarPreview})` }}
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        className="rounded-lg border border-border-light dark:border-border-dark px-3 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark hover:bg-background-light dark:hover:bg-background-dark disabled:opacity-70"
                        type="button"
                        onClick={handleAvatarClick}
                        disabled={editUploading}
                      >
                        {editUploading ? "Uploading..." : "Upload photo"}
                      </button>
                      <button
                        className="text-xs font-semibold text-text-sub-light dark:text-text-sub-dark hover:text-primary"
                        type="button"
                        onClick={() =>
                          setEditForm((current) => ({
                            ...current,
                            profilePicUrl: "",
                          }))
                        }
                      >
                        Remove photo
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </div>
                  </div>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-text-sub-light dark:text-text-sub-dark">
                      Username
                    </span>
                    <input
                      className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                      value={editForm.username}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                      placeholder="your-username"
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-text-sub-light dark:text-text-sub-dark">
                      Bio
                    </span>
                    <textarea
                      className="w-full min-h-[120px] rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                      value={editForm.bio}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          bio: event.target.value,
                        }))
                      }
                      placeholder="Tell people about yourself..."
                    />
                    <div className="text-xs text-text-sub-light dark:text-text-sub-dark text-right">
                      {editForm.bio.length}/280
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-text-sub-light dark:text-text-sub-dark">
                      Profile image URL
                    </span>
                    <input
                      className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                      value={editForm.profilePicUrl}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          profilePicUrl: event.target.value,
                        }))
                      }
                      placeholder="https://"
                    />
                  </label>

                  {editError ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                      {editError}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between pt-2">
                    <Link
                      className="text-xs font-semibold text-primary hover:underline"
                      href="/user/settings"
                    >
                      Open full settings
                    </Link>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-lg border border-border-light dark:border-border-dark px-4 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark hover:bg-background-light dark:hover:bg-background-dark"
                        type="button"
                        onClick={closeEditModal}
                      >
                        Cancel
                      </button>
                      <button
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70"
                        type="submit"
                        disabled={editSaving}
                      >
                        {editSaving ? "Saving..." : "Save changes"}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : null}

        {reportTarget ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setReportTarget(null)}
            />
            <div
              className="relative w-full max-w-lg rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                    Report review
                  </h3>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark mt-1">
                    {reportTarget.reviewTitle}
                  </p>
                </div>
                <button
                  className="text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark"
                  type="button"
                  onClick={() => setReportTarget(null)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>
              <form className="flex flex-col gap-4" onSubmit={handleReportSubmit}>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">
                    Reason
                  </span>
                  <input
                    className="w-full rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                    value={reportForm.reason}
                    onChange={(event) =>
                      setReportForm((current) => ({
                        ...current,
                        reason: event.target.value,
                      }))
                    }
                    placeholder="Why are you reporting this review?"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">
                    Details (optional)
                  </span>
                  <textarea
                    className="w-full min-h-[120px] rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-3 py-2 text-sm text-text-main-light dark:text-text-main-dark"
                    value={reportForm.details}
                    onChange={(event) =>
                      setReportForm((current) => ({
                        ...current,
                        details: event.target.value,
                      }))
                    }
                    placeholder="Share any additional details..."
                  />
                </label>
                {reportError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">
                    {reportError}
                  </div>
                ) : null}
                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    className="rounded-lg border border-border-light dark:border-border-dark px-4 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark hover:bg-background-light dark:hover:bg-background-dark"
                    type="button"
                    onClick={() => setReportTarget(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70"
                    type="submit"
                    disabled={reportSubmitting}
                  >
                    {reportSubmitting ? "Sending..." : "Submit report"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {achievementsOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setAchievementsOpen(false)}
            />
            <div
              className="relative w-full max-w-md rounded-xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-xl p-6"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-text-main-light dark:text-text-main-dark">
                  Achievements
                </h3>
                <button
                  className="text-text-sub-light dark:text-text-sub-dark hover:text-text-main-light dark:hover:text-text-main-dark"
                  type="button"
                  onClick={() => setAchievementsOpen(false)}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {achievements.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-text-main-light dark:text-text-main-dark">
                      {item.title}
                    </p>
                    <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {children}
      </div>
    </UserProfileActionsContext.Provider>
  );
}

export function UserProfileHeaderActions() {
  const {
    isSelf,
    isFollowing,
    followLabel,
    followIcon,
    onFollowClick,
    onMessageClick,
    onMoreClick,
  } = useUserProfileActions();

  return (
    <>
      <button
        className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-sm transition-all gap-2 flex-1 md:flex-none"
        type="button"
        data-profile-follow
        onClick={onFollowClick}
        aria-pressed={isSelf ? undefined : isFollowing}
      >
        <span
          className="material-symbols-outlined text-[18px]"
          data-follow-icon
        >
          {followIcon}
        </span>
        <span data-follow-label>{followLabel}</span>
      </button>
      <button
        className="flex items-center justify-center rounded-lg h-10 px-4 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark text-text-main-light dark:text-text-main-dark text-sm font-bold transition-all gap-2 flex-1 md:flex-none"
        type="button"
        data-profile-message
        onClick={onMessageClick}
      >
        <span className="material-symbols-outlined text-[18px]">mail</span>
        <span>Message</span>
      </button>
      <button
        className="flex items-center justify-center rounded-lg h-10 w-10 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark text-text-sub-light dark:text-text-sub-dark transition-all"
        type="button"
        data-profile-more
        onClick={onMoreClick}
      >
        <span className="material-symbols-outlined text-[20px]">
          more_horiz
        </span>
      </button>
    </>
  );
}

type UserProfileShareLinkProps = {
  href: string;
  className: string;
  ariaLabel?: string;
  children: ReactNode;
};

export function UserProfileShareLink({
  href,
  className,
  ariaLabel,
  children,
}: UserProfileShareLinkProps) {
  const { onShareProfileClick } = useUserProfileActions();

  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();
      onShareProfileClick();
    },
    [onShareProfileClick]
  );

  return (
    <Link
      className={className}
      href={href}
      onClick={handleClick}
      data-profile-link
      aria-label={ariaLabel}
    >
      {children}
    </Link>
  );
}

type UserProfileAchievementsTriggerProps = {
  className: string;
  children: ReactNode;
};

export function UserProfileAchievementsTrigger({
  className,
  children,
}: UserProfileAchievementsTriggerProps) {
  const { onOpenAchievements } = useUserProfileActions();

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLSpanElement>) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      onOpenAchievements();
    },
    [onOpenAchievements]
  );

  return (
    <span
      className={className}
      data-profile-achievements
      role="button"
      tabIndex={0}
      onClick={onOpenAchievements}
      onKeyDown={handleKeyDown}
    >
      {children}
    </span>
  );
}
