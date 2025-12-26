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
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import {
  getProfile,
  presignUpload,
  reportReview,
  updateProfile,
  voteReview,
} from "@/src/lib/api-client";
import {
  ensureAuthLoaded,
  getAccessToken,
  getCurrentUser,
  signOut,
} from "@/src/lib/auth";
import { FALLBACK_PROFILE_IMAGES } from "@/src/lib/review-utils";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";

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
  isSigningOut: boolean;
  followLabel: string;
  followIcon: string;
  onFollowClick: () => void;
  onMessageClick: () => void;
  onMoreClick: () => void;
  onSignOut: () => void;
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

const SUPPORT_EMAIL = "support@irecommend.clone";

export default function UserProfileActionsClient({
  username,
  displayName,
  children,
}: UserProfileActionsClientProps) {
  const router = useRouter();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
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
  const [signingOut, setSigningOut] = useState(false);

  const reportSchema = useMemo(
    () =>
      z.object({
        reason: z
          .string()
          .trim()
          .min(3, t(lang, "profileActions.validation.reportReasonShort"))
          .max(200, t(lang, "profileActions.validation.reportReasonLong")),
        details: z
          .string()
          .trim()
          .max(1000, t(lang, "profileActions.validation.reportDetailsLong"))
          .optional()
          .or(z.literal("")),
      }),
    [lang]
  );

  const messageSchema = useMemo(
    () =>
      z.object({
        subject: z
          .string()
          .trim()
          .min(3, t(lang, "profileActions.validation.messageSubjectShort"))
          .max(120, t(lang, "profileActions.validation.messageSubjectLong")),
        body: z
          .string()
          .trim()
          .min(10, t(lang, "profileActions.validation.messageBodyShort"))
          .max(1000, t(lang, "profileActions.validation.messageBodyLong")),
      }),
    [lang]
  );

  const profileSchema = useMemo(
    () =>
      z.object({
        username: z
          .string()
          .trim()
          .min(3, t(lang, "profileActions.validation.usernameShort"))
          .max(24, t(lang, "profileActions.validation.usernameLong"))
          .regex(
            /^[a-z0-9_-]+$/i,
            t(lang, "profileActions.validation.usernameInvalid")
          ),
        bio: z
          .string()
          .trim()
          .max(280, t(lang, "profileActions.validation.bioLong"))
          .optional(),
        profilePicUrl: z.string().url().optional().nullable(),
      }),
    [lang]
  );

  const achievements = useMemo(
    () => [
      {
        title: t(lang, "sidebar.achievementGoldReviewer"),
        description: t(lang, "profileActions.achievements.goldDescription"),
      },
      {
        title: t(lang, "sidebar.achievementConsistentWriter"),
        description: t(lang, "profileActions.achievements.consistentDescription"),
      },
      {
        title: t(lang, "sidebar.achievementHelpfulHero"),
        description: t(lang, "profileActions.achievements.helpfulDescription"),
      },
      {
        title: t(lang, "profileActions.achievements.moreTitle"),
        description: t(lang, "profileActions.achievements.moreDescription"),
      },
    ],
    [lang]
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
          : localizePath("/catalog", lang);
      const loginPath = localizePath("/user/login", lang);
      router.push(`${loginPath}?next=${encodeURIComponent(next)}`);
      return false;
    }
    return true;
  }, [lang, router]);

  const buildProfileUrl = useCallback(() => {
    const path = localizePath(`/users/${encodeURIComponent(username)}`, lang);
    if (typeof window === "undefined") {
      return path;
    }
    return new URL(path, window.location.origin).toString();
  }, [lang, username]);

  const shareLink = useCallback(
    async (url: string, title: string) => {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        try {
          await navigator.share({ title, url });
          showToast(t(lang, "profileActions.toast.shared"), "success");
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
          showToast(t(lang, "profileActions.toast.linkCopied"), "success");
          return;
        } catch (error) {
          console.error("Failed to copy link", error);
        }
      }

      showToast(t(lang, "profileActions.toast.linkCopyFailed"), "error");
    },
    [lang, showToast]
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
      setEditError(t(lang, "profileActions.toast.profileLoadFailed"));
    } finally {
      setEditLoading(false);
    }
  }, [lang, username]);

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
      setEditError(t(lang, "profileActions.toast.imageInvalid"));
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
      showToast(t(lang, "profileActions.toast.photoUploaded"), "success");
    } catch (error) {
      console.error("Failed to upload avatar", error);
      setEditError(t(lang, "profileActions.toast.photoUploadFailed"));
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
    showToast(
      nextState
        ? t(lang, "profileActions.toast.followed")
        : t(lang, "profileActions.toast.unfollowed"),
      "success"
    );
  }, [isFollowing, isSelf, lang, openEditModal, requireAuth, showToast, username]);

  const handleMessageClick = useCallback(async () => {
    if (isSelf) {
      showToast(
        t(lang, "profileActions.toast.selfProfileInfo"),
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
      subject: t(lang, "profileActions.message.subjectPlaceholder", {
        name: displayName,
      }),
      body: "",
    });
    setMessageOpen(true);
  }, [displayName, isSelf, lang, requireAuth, showToast]);

  const handleProfileShare = useCallback(async () => {
    const url = buildProfileUrl();
    await shareLink(
      url,
      t(lang, "profileActions.share.profileTitle", { name: displayName })
    );
  }, [buildProfileUrl, displayName, lang, shareLink]);

  const handleReviewShare = useCallback(
    async (reviewSlug: string, reviewTitle: string) => {
      const path = localizePath(
        `/content/${encodeURIComponent(reviewSlug)}`,
        lang
      );
      const url =
        typeof window !== "undefined"
          ? new URL(path, window.location.origin).toString()
          : path;
      await shareLink(url, reviewTitle);
    },
    [lang, shareLink]
  );

  const handleReviewComment = useCallback(
    (reviewSlug: string) => {
      const path = localizePath(
        `/content/${encodeURIComponent(reviewSlug)}`,
        lang
      );
      router.push(path);
    },
    [lang, router]
  );

  const handleReviewVote = useCallback(
    async (reviewId: string) => {
      const allowed = await requireAuth();
      if (!allowed) {
        return;
      }
      try {
        await voteReview(reviewId, "up");
        showToast(t(lang, "profileActions.toast.voteRecorded"), "success");
        router.refresh();
      } catch (error) {
        showToast(t(lang, "profileActions.toast.voteFailed"), "error");
      }
    },
    [lang, requireAuth, router, showToast]
  );

  const handleSignOut = useCallback(async () => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    try {
      await signOut();
      setIsSelf(false);
      setIsFollowing(false);
      setSelfProfile(null);
      showToast(t(lang, "profileActions.toast.signedOut"), "success");
      router.refresh();
    } catch (error) {
      console.error("Failed to sign out", error);
      showToast(t(lang, "profileActions.toast.signOutFailed"), "error");
    } finally {
      setSigningOut(false);
    }
  }, [lang, router, showToast, signingOut]);

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
      setMessageError(
        parsed.error.issues[0]?.message ??
          t(lang, "profileActions.validation.messageInvalid")
      );
      return;
    }
    setMessageSubmitting(true);
    try {
      const profileUrl = buildProfileUrl();
      const subject = t(lang, "profileActions.message.subjectTemplate", {
        subject: parsed.data.subject,
        name: displayName,
      });
      const body = t(lang, "profileActions.message.bodyTemplate", {
        name: displayName,
        username,
        body: parsed.data.body,
        profileUrl,
      });
      if (typeof window !== "undefined") {
        const mailto = new URL(`mailto:${SUPPORT_EMAIL}`);
        mailto.searchParams.set("subject", subject);
        mailto.searchParams.set("body", body);
        window.location.href = mailto.toString();
      }
      showToast(t(lang, "profileActions.toast.mailOpened"), "success");
      setMessageOpen(false);
    } catch (error) {
      console.error("Failed to open mail client", error);
      setMessageError(t(lang, "profileActions.toast.messageSendFailed"));
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
      setReportError(
        parsed.error.issues[0]?.message ??
          t(lang, "profileActions.validation.reportInvalid")
      );
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
      showToast(t(lang, "profileActions.toast.reportSubmitted"), "success");
      setReportTarget(null);
    } catch (error) {
      console.error("Failed to report review", error);
      setReportError(t(lang, "profileActions.toast.reportFailed"));
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
      setEditError(
        parsed.error.issues[0]?.message ??
          t(lang, "profileActions.validation.profileInvalid")
      );
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
      showToast(t(lang, "profileActions.toast.profileUpdated"), "success");
      closeEditModal();
      if (
        updated.username &&
        updated.username.toLowerCase() !== username.toLowerCase()
      ) {
        router.push(
          localizePath(`/users/${encodeURIComponent(updated.username)}`, lang)
        );
      } else {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to update profile", error);
      setEditError(t(lang, "profileActions.toast.profileUpdateFailed"));
    } finally {
      setEditSaving(false);
    }
  };

  const followLabel = isSelf
    ? t(lang, "profileActions.follow.editProfile")
    : isFollowing
      ? t(lang, "profileActions.follow.following")
      : t(lang, "profileActions.follow.follow");
  const followIcon = isSelf
    ? "edit"
    : isFollowing
      ? "person_check"
      : "person_add";

  const contextValue = useMemo(
    () => ({
      isSelf,
      isFollowing,
      isSigningOut: signingOut,
      followLabel,
      followIcon,
      onFollowClick: handleFollowClick,
      onMessageClick: handleMessageClick,
      onMoreClick: handleProfileShare,
      onSignOut: handleSignOut,
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
      handleSignOut,
      handleReviewComment,
      handleReviewReport,
      handleReviewShare,
      handleReviewVote,
      isFollowing,
      isSelf,
      signingOut,
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
            className={`fixed bottom-6 right-6 z-[60] rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${toast.variant === "success"
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
                  {t(lang, "profileActions.message.title")}
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
                    {t(lang, "profileActions.message.subjectLabel")}
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
                    placeholder={t(lang, "profileActions.message.subjectPlaceholder", {
                      name: displayName,
                    })}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">
                    {t(lang, "profileActions.message.bodyLabel")}
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
                    placeholder={t(lang, "profileActions.message.bodyPlaceholder")}
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
                    {t(lang, "common.cancel")}
                  </button>
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70"
                    type="submit"
                    disabled={messageSubmitting}
                  >
                    {messageSubmitting
                      ? t(lang, "profileActions.message.sending")
                      : t(lang, "profileActions.message.send")}
                  </button>
                </div>
                <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                  {t(lang, "profileActions.message.helper")}
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
                    {t(lang, "profileActions.edit.title")}
                  </h3>
                  <p className="text-xs text-text-sub-light dark:text-text-sub-dark">
                    {t(lang, "profileActions.edit.subtitle")}
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
                  {t(lang, "profileActions.edit.loading")}
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
                        {editUploading
                          ? t(lang, "profileActions.edit.uploading")
                          : t(lang, "profileActions.edit.uploadPhoto")}
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
                        {t(lang, "profileActions.edit.removePhoto")}
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
                      {t(lang, "profileActions.edit.usernameLabel")}
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
                      placeholder={t(lang, "profileActions.edit.usernamePlaceholder")}
                    />
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-text-sub-light dark:text-text-sub-dark">
                      {t(lang, "profileActions.edit.bioLabel")}
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
                      placeholder={t(lang, "profileActions.edit.bioPlaceholder")}
                    />
                    <div className="text-xs text-text-sub-light dark:text-text-sub-dark text-right">
                      {editForm.bio.length}/280
                    </div>
                  </label>

                  <label className="flex flex-col gap-2 text-sm">
                    <span className="text-text-sub-light dark:text-text-sub-dark">
                      {t(lang, "profileActions.edit.photoUrlLabel")}
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
                      placeholder={t(lang, "profileActions.edit.photoUrlPlaceholder")}
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
                      href={localizePath("/user/settings", lang)}
                    >
                      {t(lang, "profileActions.edit.openSettings")}
                    </Link>
                    <div className="flex items-center gap-3">
                      <button
                        className="rounded-lg border border-border-light dark:border-border-dark px-4 py-2 text-sm font-semibold text-text-main-light dark:text-text-main-dark hover:bg-background-light dark:hover:bg-background-dark"
                        type="button"
                        onClick={closeEditModal}
                      >
                        {t(lang, "common.cancel")}
                      </button>
                      <button
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70"
                        type="submit"
                        disabled={editSaving}
                      >
                        {editSaving
                          ? t(lang, "profileActions.edit.saving")
                          : t(lang, "common.saveChanges")}
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
                    {t(lang, "profileActions.report.title")}
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
                    {t(lang, "profileActions.report.reasonLabel")}
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
                    placeholder={t(lang, "profileActions.report.reasonPlaceholder")}
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm">
                  <span className="text-text-sub-light dark:text-text-sub-dark">
                    {t(lang, "profileActions.report.detailsLabel")}
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
                    placeholder={t(lang, "profileActions.report.detailsPlaceholder")}
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
                    {t(lang, "common.cancel")}
                  </button>
                  <button
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark disabled:opacity-70"
                    type="submit"
                    disabled={reportSubmitting}
                  >
                    {reportSubmitting
                      ? t(lang, "profileActions.report.sending")
                      : t(lang, "profileActions.report.submit")}
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
                  {t(lang, "profileActions.achievements.title")}
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
    isSigningOut,
    followLabel,
    followIcon,
    onFollowClick,
    onMessageClick,
    onMoreClick,
    onSignOut,
  } = useUserProfileActions();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );

  return (
    <>
      <button
        className="flex items-center justify-center rounded-lg h-10 px-6 bg-primary hover:bg-primary-dark text-white text-sm font-bold shadow-sm transition-all gap-2 flex-1 md:flex-none whitespace-nowrap"
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
        className="flex items-center justify-center rounded-lg h-10 px-4 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark text-text-main-light dark:text-text-main-dark text-sm font-bold transition-all gap-2 flex-1 md:flex-none disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
        type="button"
        data-profile-message
        onClick={isSelf ? onSignOut : onMessageClick}
        disabled={isSelf && isSigningOut}
      >
        <span className="material-symbols-outlined text-[18px]">
          {isSelf ? "logout" : "mail"}
        </span>
        <span>
          {isSelf
            ? isSigningOut
              ? t(lang, "profileActions.header.signingOut")
              : t(lang, "profileActions.header.signOut")
            : t(lang, "profileActions.header.message")}
        </span>
      </button>
      <button
        className="flex items-center justify-center rounded-lg h-10 w-10 border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:bg-background-light dark:hover:bg-background-dark text-text-sub-light dark:text-text-sub-dark transition-all shrink-0"
        type="button"
        data-profile-more
        onClick={onMoreClick}
      >
        <span className="material-symbols-outlined text-[20px] overflow-hidden">
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
