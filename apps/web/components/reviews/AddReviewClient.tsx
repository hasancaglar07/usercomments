"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { createReview, presignUpload } from "@/src/lib/api-client";
import { getSubcategories } from "@/src/lib/api";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";
import { Category } from "@/src/types";

type UploadStatus = "idle" | "uploading" | "success" | "error";

type PhotoFile = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  progress: number;
  publicUrl?: string;
  error?: string;
};

interface AddReviewClientProps {
  categories: Category[];
}

const reviewSchema = z.object({
  categoryId: z.string().min(1, "Please select a category."),
  subCategoryId: z.string().optional(),
  title: z.string().trim().min(5, "Please enter a review title."),
  body: z.string().trim().min(20, "Please share more details in your review."),
  rating: z.number().min(1, "Please select a rating.").max(5),
  pros: z.string().optional(),
  cons: z.string().optional(),
});

export default function AddReviewClient({ categories }: AddReviewClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [categoryId, setCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(4);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [body, setBody] = useState("");
  const [recommends, setRecommends] = useState(true);

  // UI State
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [photos, setPhotos] = useState<PhotoFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      await ensureAuthLoaded();
      if (!getAccessToken()) {
        router.replace("/user/login?next=/node/add/review");
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [router]);

  // Load subcategories when category changes
  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubCategoryId("");
      return;
    }

    const fetchSubs = async () => {
      setLoadingSubcategories(true);
      try {
        const subs = await getSubcategories(Number(categoryId));
        setSubcategories(subs);
        setSubCategoryId(""); // Reset subcategory when category changes
      } catch (error) {
        console.error("Failed to load subcategories:", error);
      } finally {
        setLoadingSubcategories(false);
      }
    };

    fetchSubs();
  }, [categoryId]);

  const handleRatingClick = (val: number) => {
    setRating(val);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const newFiles = Array.from(e.target.files).map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "idle" as UploadStatus,
      progress: 0,
    }));

    setPhotos((prev) => [...prev, ...newFiles]);

    // Automatically start uploading new files
    newFiles.forEach(uploadPhoto);

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadPhoto = async (photo: PhotoFile) => {
    // Only upload if idle or error
    if (photo.status === "uploading" || photo.status === "success") return;

    const maxBytes = 5 * 1024 * 1024;
    if (photo.file.size > maxBytes) {
      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, status: "error", error: "File too large (max 5MB)" }
            : p
        )
      );
      return;
    }

    setPhotos((prev) =>
      prev.map((p) => (p.id === photo.id ? { ...p, status: "uploading", progress: 10 } : p))
    );

    try {
      const { uploadUrl, publicUrl } = await presignUpload({
        filename: photo.file.name,
        contentType: photo.file.type || "application/octet-stream",
      });

      // Simulate some progress increments since pure PUT via fetch doesn't give fine-grained progress easily without XHR
      // But for better UX, we can use a small interval or just jump to 90%
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, progress: 40 } : p))
      );

      const response = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": photo.file.type || "application/octet-stream",
        },
        body: photo.file,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`);
      }

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, status: "success", progress: 100, publicUrl }
            : p
        )
      );
    } catch (error) {
      console.error("Upload error detail:", error);
      const isNetworkError = error instanceof Error && error.message.includes("fetch");
      const errorMessage = isNetworkError
        ? "Network error (CORS?). Check bucket configuration."
        : error instanceof Error ? error.message : "Upload failed.";

      setPhotos((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, status: "error", error: errorMessage }
            : p
        )
      );
    }
  };

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // Clean up object URLs to prevent memory leaks
      const removed = prev.find((p) => p.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (photos.some((p) => p.status === "uploading")) {
      window.alert("Please wait for all photos to finish uploading.");
      return;
    }

    const parsed = reviewSchema.safeParse({
      categoryId,
      subCategoryId,
      title,
      body,
      rating,
      pros,
      cons,
    });
    if (!parsed.success) {
      window.alert(parsed.error.issues[0]?.message ?? "Please check your review details.");
      return;
    }
    if (subcategories.length > 0 && !subCategoryId) {
      window.alert("Please select a subcategory.");
      return;
    }

    setIsSubmitting(true);

    try {
      const prosList = pros
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
      const consList = cons
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 12);
      const paragraphs = body
        .trim()
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);

      const sections: string[] = [];
      if (prosList.length > 0) {
        sections.push(["Pros:", ...prosList.map((item) => `- ${item}`)].join("\n"));
      }
      if (consList.length > 0) {
        sections.push(["Cons:", ...consList.map((item) => `- ${item}`)].join("\n"));
      }
      sections.push(...paragraphs);

      const contentText = sections.join("\n\n");

      const photoUrls = photos
        .filter((p) => p.status === "success" && p.publicUrl)
        .map((p) => p.publicUrl!);

      const result = await createReview({
        title: parsed.data.title.trim(),
        excerpt: parsed.data.body.slice(0, 150) + (parsed.data.body.length > 150 ? "..." : ""),
        contentHtml: contentText,
        rating: parsed.data.rating,
        categoryId: Number(parsed.data.categoryId),
        subCategoryId: parsed.data.subCategoryId ? Number(parsed.data.subCategoryId) : undefined,
        photoUrls,
      });

      router.push(`/content/${result.slug}`);
    } catch (error) {
      console.error("Submission error:", error);
      window.alert(error instanceof Error ? error.message : "Failed to publish review.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 flex justify-center py-8 px-4 sm:px-6">
      <div className="layout-content-container flex flex-col max-w-[960px] w-full flex-1 gap-6">
        <div className="flex flex-wrap justify-between gap-3 px-4">
          <div className="flex min-w-72 flex-col gap-2">
            <h1 className="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-tight">
              Write a Review
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base font-normal">
              Share your experience with the community
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8">
          <form className="flex flex-col gap-8" onSubmit={handleSubmit}>
            {/* Section 1: Product Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-900 dark:text-white text-base font-semibold">
                  Category
                </label>
                <div className="relative">
                  <select
                    className="w-full h-12 px-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <span className="material-symbols-outlined">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-slate-900 dark:text-white text-base font-semibold">
                  Subcategory
                </label>
                <div className="relative">
                  <select
                    className="w-full h-12 px-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    disabled={!categoryId || loadingSubcategories || subcategories.length === 0}
                  >
                    <option value="">
                      {loadingSubcategories
                        ? "Loading..."
                        : subcategories.length > 0
                          ? "Select a subcategory"
                          : "No subcategories"}
                    </option>
                    {subcategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
                    <span className="material-symbols-outlined">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-slate-900 dark:text-white text-base font-semibold">
                  Product / Service Name
                </label>
                <input
                  className="w-full h-12 px-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-400"
                  placeholder="What are you reviewing?"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>

            {/* Section 2: Review Title & Rating */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-slate-900 dark:text-white text-base font-semibold">
                  Review Title
                </label>
                <input
                  className="w-full h-12 px-4 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-slate-400 font-medium"
                  placeholder="Summarize your experience in a headline"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-slate-900 dark:text-white text-base font-semibold">
                  Your Rating
                </span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((val) => (
                    <button
                      key={val}
                      type="button"
                      className={`transition-all hover:scale-110 p-1 ${val <= rating ? "text-yellow-400" : "text-slate-300 dark:text-slate-700"
                        }`}
                      onClick={() => handleRatingClick(val)}
                    >
                      <span
                        className="material-symbols-outlined text-[36px]"
                        style={{ fontVariationSettings: val <= rating ? "'FILL' 1" : "'FILL' 0" }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                  <span className="ml-4 text-slate-500 dark:text-slate-400 font-bold">
                    {rating.toFixed(1)} / 5.0
                  </span>
                </div>
              </div>
            </div>

            {/* Section 3: Pros & Cons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="text-green-600 dark:text-green-400 text-base font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">add_circle</span> Pros
                </label>
                <textarea
                  className="w-full min-h-[120px] p-4 rounded-lg bg-green-50/30 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500/30 transition-all resize-none placeholder:text-slate-400"
                  placeholder="What did you like? (Enter each on a new line)"
                  value={pros}
                  onChange={(e) => setPros(e.target.value)}
                ></textarea>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-red-500 dark:text-red-400 text-base font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">do_not_disturb_on</span> Cons
                </label>
                <textarea
                  className="w-full min-h-[120px] p-4 rounded-lg bg-red-50/30 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/30 transition-all resize-none placeholder:text-slate-400"
                  placeholder="What could be improved? (Enter each on a new line)"
                  value={cons}
                  onChange={(e) => setCons(e.target.value)}
                ></textarea>
              </div>
            </div>

            {/* Section 4: Your Review Body */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-900 dark:text-white text-base font-semibold">
                Your Review
              </label>
              <div className="w-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50">
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  {/* Mini Editor Toolbar - Visual Only for now */}
                  {['format_bold', 'format_italic', 'format_list_bulleted', 'format_list_numbered', 'link'].map(icon => (
                    <button key={icon} type="button" className="p-2 rounded hover:bg-white dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">{icon}</span>
                    </button>
                  ))}
                </div>
                <textarea
                  className="w-full h-64 p-4 bg-transparent border-none focus:ring-0 text-slate-900 dark:text-white placeholder:text-slate-400 resize-y"
                  placeholder="Tell us about your experience..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Section 5: Photo Upload - User Oriented Improvement */}
            <div className="flex flex-col gap-3">
              <label className="text-slate-900 dark:text-white text-base font-semibold">
                Photos
              </label>

              <div
                className="group relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-bold">Add product photos</p>
                  <p className="text-slate-500 text-sm mt-1">Drag and drop or click to browse</p>
                </div>
                <p className="text-slate-400 text-xs mt-4">JPG, PNG, WEBP (Max 5MB per file)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Photo Previews */}
              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-2">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.previewUrl} className="w-full h-full object-cover" alt="Upload preview" />

                      {/* Overlay for status */}
                      <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 bg-black/40 transition-opacity ${photo.status === 'uploading' || photo.status === 'error' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {photo.status === 'uploading' && (
                          <div className="w-full px-4 flex flex-col items-center">
                            <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${photo.progress}%` }}></div>
                            </div>
                            <span className="text-[10px] text-white font-bold mt-1">Uploading...</span>
                          </div>
                        )}

                        {photo.status === 'error' && (
                          <div className="text-red-400 flex flex-col items-center text-center">
                            <span className="material-symbols-outlined text-xl">error</span>
                            <span className="text-[10px] font-bold mt-1 leading-tight">{photo.error}</span>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); uploadPhoto(photo); }}
                              className="mt-2 px-2 py-1 bg-white text-slate-900 rounded text-[10px] font-bold hover:bg-slate-100"
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {(photo.status === 'success' || photo.status === 'idle') && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removePhoto(photo.id); }}
                            className="size-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        )}
                      </div>

                      {photo.status === 'success' && (
                        <div className="absolute top-1 right-1 size-5 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
                          <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>

            {/* Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="size-5 rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                  checked={recommends}
                  onChange={(e) => setRecommends(e.target.checked)}
                />
                <span className="text-slate-900 dark:text-white font-medium group-hover:text-primary transition-colors">
                  I recommend this product
                </span>
              </label>

              <div className="flex gap-4 w-full sm:w-auto">
                <button
                  type="button"
                  className="flex-1 sm:flex-none h-12 px-6 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || photos.some(p => p.status === 'uploading')}
                  className="flex-1 sm:flex-none h-12 px-10 rounded-lg bg-primary text-white font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? "Publishing..." : "Publish Review"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-slate-400 dark:text-slate-600 text-[11px] py-4">
          By publishing, you agree to UserComments.net&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
