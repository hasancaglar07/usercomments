"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import { FALLBACK_PROFILE_IMAGES } from "@/src/lib/review-utils";
import { PROFILE_ICONS } from "@/src/lib/constants";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";
import { getProfile, presignUpload, updateProfile } from "@/src/lib/api-client";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(24, "Username must be at most 24 characters.")
    .regex(/^[a-z0-9_-]+$/i, "Use letters, numbers, - or _."),
  bio: z.string().trim().max(280, "Bio must be 280 characters or less.").optional(),
  profilePicUrl: z.string().url().optional().nullable(),
});

export default function UserSettingsClient() {
  const router = useRouter();
  const params = useParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: "",
    bio: "",
    profilePicUrl: "",
  });

  useEffect(() => {
    let isMounted = true;
    const loadProfile = async () => {
      try {
        await ensureAuthLoaded();
        if (!getAccessToken()) {
          const loginPath = localizePath("/user/login", lang);
          const nextPath = localizePath("/user/settings", lang);
          router.replace(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
          return;
        }
        const profile = await getProfile();
        if (!isMounted) {
          return;
        }
        setForm({
          username: profile.username ?? "",
          bio: profile.bio ?? "",
          profilePicUrl: profile.profilePicUrl ?? "",
        });
      } catch (error) {
        console.error("Failed to load profile settings", error);
        if (isMounted) {
          setErrorMessage("Unable to load profile settings.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, [lang, router]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please upload an image file.");
      return;
    }

    setUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
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

      setForm((current) => ({ ...current, profilePicUrl: presign.publicUrl }));
      setSuccessMessage("Avatar uploaded. Remember to save changes.");
    } catch (error) {
      console.error("Failed to upload avatar", error);
      setErrorMessage("Unable to upload avatar.");
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsed = profileSchema.safeParse({
      username: form.username,
      bio: form.bio,
      profilePicUrl: form.profilePicUrl || null,
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Invalid profile data.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: parsed.data.username,
        bio: parsed.data.bio?.trim() ? parsed.data.bio.trim() : null,
        profilePicUrl: parsed.data.profilePicUrl ?? null,
      };
      const updated = await updateProfile(payload);
      setForm({
        username: updated.username ?? "",
        bio: updated.bio ?? "",
        profilePicUrl: updated.profilePicUrl ?? "",
      });
      setSuccessMessage("Profile updated successfully.");
    } catch (error) {
      console.error("Failed to update profile", error);
      const message =
        error instanceof Error ? error.message : "Unable to update profile.";
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  };

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);

  const handleSelectIcon = (iconName: string) => {
    const url = `/profile_icon/${iconName}`;
    setForm((current) => ({ ...current, profilePicUrl: url }));
    setIsAvatarModalOpen(false);
  };

  const previewUrl = form.profilePicUrl || FALLBACK_PROFILE_IMAGES[0];

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 font-display min-h-screen">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Update your public profile details and avatar.
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-4 py-3">
            {successMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
            Loading profile settings...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col items-center gap-4">
              <div
                className="w-28 h-28 rounded-full bg-cover bg-center ring-4 ring-background-light dark:ring-background-dark"
                style={{ backgroundImage: `url(${previewUrl})` }}
              />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Profile photo
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  JPG, PNG, or WebP.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2">
                <button
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm font-bold py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  onClick={handleAvatarClick}
                  disabled={uploading}
                >
                  {uploading ? "Uploading..." : "Upload New Avatar"}
                </button>
                <button
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold py-2 text-primary hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={() => setIsAvatarModalOpen(true)}
                  disabled={uploading}
                >
                  Choose Avatar
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </section>

            <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <form className="grid gap-5" onSubmit={handleSubmit}>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Username
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    value={form.username}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        username: event.target.value,
                      }))
                    }
                    placeholder="your-username"
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Bio
                  </label>
                  <textarea
                    className="min-h-[120px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    value={form.bio}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, bio: event.target.value }))
                    }
                    placeholder="Tell people about yourself..."
                  />
                  <div className="text-xs text-slate-400 text-right">
                    {form.bio.length}/280
                  </div>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">
                    Profile image URL
                  </label>
                  <input
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                    value={form.profilePicUrl}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        profilePicUrl: event.target.value,
                      }))
                    }
                    placeholder="https://"
                  />
                  <p className="text-xs text-slate-400">
                    Clear the field to remove your avatar.
                  </p>
                </div>
                <button
                  className="w-full rounded-lg bg-primary text-white text-sm font-bold py-2 hover:bg-primary-dark transition-colors disabled:opacity-70"
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </form>
            </section>
          </div>
        )}
      </main>

      {/* Avatar Selection Modal */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Choose an Avatar</h3>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
                {PROFILE_ICONS.map((icon: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectIcon(icon)}
                    className="group relative aspect-square rounded-xl overflow-hidden hover:ring-4 hover:ring-primary/50 transition-all"
                  >
                    <img
                      src={`/profile_icon/${icon}`}
                      alt="Avatar option"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-slate-950 flex justify-end">
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
