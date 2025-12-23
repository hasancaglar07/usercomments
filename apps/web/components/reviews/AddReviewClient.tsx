"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { createReview, presignUpload } from "@/src/lib/api-client";
import { getProductBySlug, getSubcategories, searchProducts } from "@/src/lib/api";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";
import { Category, Product } from "@/src/types";
import { localizePath, normalizeLanguage } from "@/src/lib/i18n";
import { formatNumber } from "@/src/lib/review-utils";

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

type ProductSearchStatus = "idle" | "loading" | "ready" | "error";

interface AddReviewClientProps {
  categories: Category[];
}

const reviewSchema = z.object({
  categoryId: z.string().min(1, "Please select a category."),
  subCategoryId: z.string().optional(),
  productName: z.string().trim().optional(),
  title: z.string().trim().min(5, "Please enter a review title."),
  body: z.string().trim().min(20, "Please share more details in your review."),
  rating: z.number().min(1, "Please select a rating.").max(5),
  pros: z.string().optional(),
  cons: z.string().optional(),
});

export default function AddReviewClient({ categories }: AddReviewClientProps) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const lang = normalizeLanguage(
    typeof params?.lang === "string" ? params.lang : undefined
  );
  const productFileInputRef = useRef<HTMLInputElement>(null);
  const reviewFileInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSubCategoryIdsRef = useRef<number[] | null>(null);

  // Form State
  const [categoryId, setCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [productName, setProductName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [productSuggestions, setProductSuggestions] = useState<Product[]>([]);
  const [productSearchStatus, setProductSearchStatus] =
    useState<ProductSearchStatus>("idle");
  const [productSearchMessage, setProductSearchMessage] = useState<string | null>(
    null
  );
  const [categorySelectionToken, setCategorySelectionToken] = useState(0);
  const [confirmNewProduct, setConfirmNewProduct] = useState(false);
  const [autoMatched, setAutoMatched] = useState(false);
  const [title, setTitle] = useState("");
  const [rating, setRating] = useState(4);
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");
  const [body, setBody] = useState("");
  const [recommends, setRecommends] = useState(true);

  // UI State
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [loadingSubcategories, setLoadingSubcategories] = useState(false);
  const [productPhoto, setProductPhoto] = useState<PhotoFile | null>(null);
  const [reviewPhotos, setReviewPhotos] = useState<PhotoFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const trimmedProductName = productName.trim();
  const isNewProductFlow =
    !selectedProduct &&
    trimmedProductName.length > 0 &&
    productSuggestions.length === 0 &&
    productSearchStatus !== "loading" &&
    productSearchStatus !== "idle";
  const isProductSearchError = productSearchStatus === "error";

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      await ensureAuthLoaded();
      if (!getAccessToken()) {
        const loginPath = localizePath("/user/login", lang);
        const nextPath = localizePath("/node/add/review", lang);
        router.replace(`${loginPath}?next=${encodeURIComponent(nextPath)}`);
      } else {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, [lang, router]);

  useEffect(() => {
    const productSlug = searchParams.get("productSlug");
    if (!productSlug || selectedProduct) {
      return;
    }

    let cancelled = false;

    getProductBySlug(productSlug, lang)
      .then((product) => {
        if (cancelled) {
          return;
        }
        setSelectedProduct(product);
        setProductName(product.name);
        setAutoMatched(false);
        setConfirmNewProduct(false);
      })
      .catch((error) => {
        console.error("Failed to load product from link:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [lang, searchParams, selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }
    setProductPhoto((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  }, [selectedProduct]);

  useEffect(() => {
    if (!selectedProduct) {
      pendingSubCategoryIdsRef.current = null;
      return;
    }

    const productCategoryIds = (selectedProduct.categoryIds ?? []).filter(
      (id): id is number => typeof id === "number" && Number.isFinite(id)
    );

    if (productCategoryIds.length === 0 || categories.length === 0) {
      pendingSubCategoryIdsRef.current = null;
      return;
    }

    let cancelled = false;

    const applyProductCategories = async () => {
      const topLevelIds = new Set(categories.map((category) => category.id));
      const directCategoryId = productCategoryIds.find((id) => topLevelIds.has(id));

      if (directCategoryId) {
        if (cancelled) {
          return;
        }
        pendingSubCategoryIdsRef.current = productCategoryIds;
        setCategoryId(String(directCategoryId));
        setCategorySelectionToken((prev) => prev + 1);
        return;
      }

      for (const category of categories) {
        try {
          const subs = await getSubcategories(category.id, lang);
          const match = subs.find((sub) => productCategoryIds.includes(sub.id));
          if (match) {
            if (cancelled) {
              return;
            }
            pendingSubCategoryIdsRef.current = [match.id];
            setCategoryId(String(category.id));
            setCategorySelectionToken((prev) => prev + 1);
            return;
          }
        } catch (error) {
          console.error("Failed to resolve product subcategory:", error);
        }
      }
    };

    applyProductCategories();

    return () => {
      cancelled = true;
    };
  }, [categories, lang, selectedProduct]);

  // Load subcategories when category changes
  useEffect(() => {
    if (!categoryId) {
      setSubcategories([]);
      setSubCategoryId("");
      pendingSubCategoryIdsRef.current = null;
      return;
    }

    const fetchSubs = async () => {
      setLoadingSubcategories(true);
      try {
        const subs = await getSubcategories(Number(categoryId), lang);
        setSubcategories(subs);
        const pendingIds = pendingSubCategoryIdsRef.current;
        if (pendingIds && pendingIds.length > 0) {
          const matched = subs.find((sub) => pendingIds.includes(sub.id));
          setSubCategoryId(matched ? String(matched.id) : "");
          pendingSubCategoryIdsRef.current = null;
        } else {
          setSubCategoryId("");
        }
      } catch (error) {
        console.error("Failed to load subcategories:", error);
      } finally {
        setLoadingSubcategories(false);
      }
    };

    fetchSubs();
  }, [categoryId, lang, categorySelectionToken]);

  useEffect(() => {
    const query = productName.trim();
    if (!query) {
      setProductSuggestions([]);
      setProductSearchStatus("idle");
      setProductSearchMessage(null);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    setProductSearchStatus("loading");
    setProductSearchMessage(null);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await searchProducts(query, 6, lang, true);
        setProductSuggestions(result.items);
        setProductSearchStatus("ready");
        if (result.items.length === 0) {
          setProductSearchMessage("No matching products found.");
        }
      } catch (error) {
        console.error("Failed to search products:", error);
        setProductSearchStatus("error");
        setProductSearchMessage("Unable to search products right now.");
      }
    }, 350);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [lang, productName]);

  useEffect(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || productName.trim() || selectedProduct) {
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const result = await searchProducts(trimmedTitle, 3, lang, true);
        if (result.items.length > 0) {
          const matched = result.items[0];
          setSelectedProduct(matched);
          setProductName(matched.name);
          setAutoMatched(true);
          setConfirmNewProduct(false);
        }
      } catch (error) {
        console.error("Auto-match failed:", error);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [lang, productName, selectedProduct, title]);

  useEffect(() => {
    if (selectedProduct && productName.trim() !== selectedProduct.name) {
      setSelectedProduct(null);
      setAutoMatched(false);
    }
  }, [productName, selectedProduct]);

  const handleRatingClick = (val: number) => {
    setRating(val);
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setProductName(product.name);
    setAutoMatched(false);
    setProductSearchMessage(null);
    setConfirmNewProduct(false);
  };

  const handleProductClear = () => {
    setSelectedProduct(null);
    setAutoMatched(false);
    setConfirmNewProduct(false);
  };

  const createPhotoFile = (file: File): PhotoFile => ({
    id: Math.random().toString(36).substring(7),
    file,
    previewUrl: URL.createObjectURL(file),
    status: "idle",
    progress: 0,
  });

  const updateReviewPhoto = (id: string, updates: Partial<PhotoFile>) => {
    setReviewPhotos((prev) =>
      prev.map((photo) => (photo.id === id ? { ...photo, ...updates } : photo))
    );
  };

  const updateProductPhoto = (id: string, updates: Partial<PhotoFile>) => {
    setProductPhoto((prev) =>
      prev && prev.id === id ? { ...prev, ...updates } : prev
    );
  };

  const uploadPhoto = async (
    photo: PhotoFile,
    applyUpdates: (updates: Partial<PhotoFile>) => void
  ) => {
    // Only upload if idle or error
    if (photo.status === "uploading" || photo.status === "success") return;

    const maxBytes = 5 * 1024 * 1024;
    if (photo.file.size > maxBytes) {
      applyUpdates({ status: "error", error: "File too large (max 5MB)" });
      return;
    }

    applyUpdates({ status: "uploading", progress: 10, error: undefined });

    try {
      const { uploadUrl, publicUrl } = await presignUpload({
        filename: photo.file.name,
        contentType: photo.file.type || "application/octet-stream",
      });

      // Simulate some progress increments since pure PUT via fetch doesn't give fine-grained progress easily without XHR
      // But for better UX, we can use a small interval or just jump to 90%
      applyUpdates({ progress: 40 });

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

      applyUpdates({ status: "success", progress: 100, publicUrl });
    } catch (error) {
      console.error("Upload error detail:", error);
      const isNetworkError = error instanceof Error && error.message.includes("fetch");
      const errorMessage = isNetworkError
        ? "Network error (CORS?). Check bucket configuration."
        : error instanceof Error ? error.message : "Upload failed.";

      applyUpdates({ status: "error", error: errorMessage });
    }
  };

  const uploadReviewPhoto = (photo: PhotoFile) =>
    uploadPhoto(photo, (updates) => updateReviewPhoto(photo.id, updates));

  const uploadProductPhoto = (photo: PhotoFile) =>
    uploadPhoto(photo, (updates) => updateProductPhoto(photo.id, updates));

  const handleReviewFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;

    const newFiles = Array.from(e.target.files).map(createPhotoFile);
    setReviewPhotos((prev) => [...prev, ...newFiles]);
    newFiles.forEach(uploadReviewPhoto);

    if (reviewFileInputRef.current) {
      reviewFileInputRef.current.value = "";
    }
  };

  const handleProductFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newPhoto = createPhotoFile(file);
    setProductPhoto((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return newPhoto;
    });
    uploadProductPhoto(newPhoto);

    if (productFileInputRef.current) {
      productFileInputRef.current.value = "";
    }
  };

  const removeReviewPhoto = (id: string) => {
    setReviewPhotos((prev) => {
      const filtered = prev.filter((photo) => photo.id !== id);
      const removed = prev.find((photo) => photo.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return filtered;
    });
  };

  const removeProductPhoto = () => {
    setProductPhoto((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const hasUploadingPhotos =
      reviewPhotos.some((photo) => photo.status === "uploading") ||
      productPhoto?.status === "uploading";

    if (hasUploadingPhotos) {
      window.alert("Please wait for all photos to finish uploading.");
      return;
    }

    const parsed = reviewSchema.safeParse({
      categoryId,
      subCategoryId,
      productName,
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
    if (!selectedProduct) {
      const nameValue = parsed.data.productName?.trim() ?? "";
      if (!nameValue) {
        window.alert("Please select a product or create a new one.");
        return;
      }
      if (productSearchStatus === "loading" || productSearchStatus === "idle") {
        window.alert("Please wait for product search to finish.");
        return;
      }
      if (productSuggestions.length > 0) {
        window.alert("Please select a product from the list.");
        return;
      }
      if (!confirmNewProduct) {
        window.alert("Please confirm creating the new product.");
        return;
      }
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

      const photoUrls = reviewPhotos
        .filter((photo) => photo.status === "success" && photo.publicUrl)
        .map((photo) => photo.publicUrl!);

      const productPhotoUrl =
        isNewProductFlow && productPhoto?.status === "success" && productPhoto.publicUrl
          ? productPhoto.publicUrl
          : undefined;

      const result = await createReview({
        title: parsed.data.title.trim(),
        excerpt: parsed.data.body.slice(0, 150) + (parsed.data.body.length > 150 ? "..." : ""),
        contentHtml: contentText,
        rating: parsed.data.rating,
        recommend: recommends,
        pros: prosList,
        cons: consList,
        categoryId: Number(parsed.data.categoryId),
        subCategoryId: parsed.data.subCategoryId ? Number(parsed.data.subCategoryId) : undefined,
        productId: selectedProduct?.id,
        productName: selectedProduct ? undefined : parsed.data.productName?.trim(),
        photoUrls,
        productPhotoUrl,
        lang,
      });

      router.push(localizePath(`/content/${result.slug}`, lang));
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
            <input
              type="file"
              ref={productFileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleProductFileSelect}
            />
            <input
              type="file"
              ref={reviewFileInputRef}
              className="hidden"
              multiple
              accept="image/*"
              onChange={handleReviewFileSelect}
            />
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
                  placeholder="Search for a product or add a new one"
                  value={productName}
                  onChange={(e) => {
                    setProductName(e.target.value);
                    setConfirmNewProduct(false);
                  }}
                />
                {selectedProduct ? (
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-3">
                    <div
                      className="size-12 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 bg-cover bg-center"
                      style={{
                        backgroundImage: selectedProduct.images?.[0]?.url
                          ? `url(${selectedProduct.images[0].url})`
                          : "none",
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {selectedProduct.name}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatNumber(selectedProduct.stats?.reviewCount)} reviews · Rating{" "}
                        {selectedProduct.stats?.ratingAvg?.toFixed(1) ?? "—"}
                      </p>
                      {autoMatched ? (
                        <p className="text-[11px] text-emerald-600">
                          Matched automatically from your title
                        </p>
                      ) : null}
                      {selectedProduct.status === "pending" ? (
                        <p className="text-[11px] text-amber-600">
                          Pending approval
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={handleProductClear}
                      className="text-xs font-semibold text-slate-500 hover:text-primary"
                    >
                      Change
                    </button>
                  </div>
                ) : productName.trim() ? (
                  <div className="mt-2 space-y-2">
                    {productSearchStatus === "loading" ? (
                      <p className="text-xs text-slate-500">
                        Searching products...
                      </p>
                    ) : null}
                    {productSuggestions.length > 0 ? (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-700">
                        {productSuggestions.map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleProductSelect(product)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div
                              className="size-10 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 bg-cover bg-center"
                              style={{
                                backgroundImage: product.images?.[0]?.url
                                  ? `url(${product.images[0].url})`
                                  : "none",
                              }}
                            />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {product.name}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {formatNumber(product.stats?.reviewCount)} reviews · Rating{" "}
                                {product.stats?.ratingAvg?.toFixed(1) ?? "—"}
                              </p>
                            </div>
                            {product.status === "pending" ? (
                              <span className="text-[10px] font-semibold text-amber-600">
                                Pending
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {productSearchMessage && !isNewProductFlow ? (
                      <p className="text-xs text-slate-500">
                        {productSearchMessage}
                      </p>
                    ) : null}
                    {isNewProductFlow ? (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-900/20 p-4 space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="material-symbols-outlined text-amber-600">
                            info
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {isProductSearchError
                                ? "Search is unavailable right now."
                                : `We couldn't find "${trimmedProductName}".`}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              {isProductSearchError
                                ? "You can still create this product and send it for admin approval."
                                : "We can add it and send it to the admin approval queue so others can find it too."}
                            </p>
                          </div>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <input
                            type="checkbox"
                            className="size-4 rounded border-slate-300 text-primary focus:ring-primary"
                            checked={confirmNewProduct}
                            onChange={(event) => setConfirmNewProduct(event.target.checked)}
                          />
                          Yes, create this product and send it for approval.
                        </label>
                        <div className={confirmNewProduct ? "space-y-3" : "space-y-3 opacity-60 pointer-events-none"}>
                          <div
                            className="group relative border-2 border-dashed border-amber-200 dark:border-amber-900/60 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-amber-50/60 dark:hover:bg-amber-900/30 transition-all cursor-pointer"
                            onClick={() => productFileInputRef.current?.click()}
                          >
                            <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                              <span className="material-symbols-outlined text-[28px]">
                                photo_camera
                              </span>
                            </div>
                            <div>
                              <p className="text-slate-900 dark:text-white font-bold">
                                Add a product photo
                              </p>
                              <p className="text-slate-500 text-sm mt-1">
                                This image will appear on the product page once approved.
                              </p>
                            </div>
                            <p className="text-slate-400 text-xs mt-3">
                              JPG, PNG, WEBP (Max 5MB per file)
                            </p>
                          </div>

                          {productPhoto ? (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                              <div
                                key={productPhoto.id}
                                className="relative aspect-square rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden group"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={productPhoto.previewUrl}
                                  className="w-full h-full object-cover"
                                  alt="Upload preview"
                                />

                                <div className={`absolute inset-0 flex flex-col items-center justify-center p-2 bg-black/40 transition-opacity ${productPhoto.status === 'uploading' || productPhoto.status === 'error' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                  {productPhoto.status === 'uploading' && (
                                    <div className="w-full px-4 flex flex-col items-center">
                                      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary transition-all duration-300" style={{ width: `${productPhoto.progress}%` }}></div>
                                      </div>
                                      <span className="text-[10px] text-white font-bold mt-1">Uploading...</span>
                                    </div>
                                  )}

                                  {productPhoto.status === 'error' && (
                                    <div className="text-red-400 flex flex-col items-center text-center">
                                      <span className="material-symbols-outlined text-xl">error</span>
                                      <span className="text-[10px] font-bold mt-1 leading-tight">{productPhoto.error}</span>
                                      <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); uploadProductPhoto(productPhoto); }}
                                        className="mt-2 px-2 py-1 bg-white text-slate-900 rounded text-[10px] font-bold hover:bg-slate-100"
                                      >
                                        Retry
                                      </button>
                                    </div>
                                  )}

                                  {(productPhoto.status === 'success' || productPhoto.status === 'idle') && (
                                    <button
                                      type="button"
                                      onClick={(event) => { event.stopPropagation(); removeProductPhoto(); }}
                                      className="size-8 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                                    >
                                      <span className="material-symbols-outlined text-xl">delete</span>
                                    </button>
                                  )}
                                </div>

                                {productPhoto.status === 'success' && (
                                  <div className="absolute top-1 right-1 size-5 rounded-full bg-green-500 text-white flex items-center justify-center shadow-sm">
                                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Add a clear photo to help the admin verify the product faster.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
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

            <div className="flex flex-col gap-3">
              <label className="text-slate-900 dark:text-white text-base font-semibold">
                Review Photos
              </label>

              <div
                className="group relative border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-all cursor-pointer"
                onClick={() => reviewFileInputRef.current?.click()}
              >
                <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-[32px]">cloud_upload</span>
                </div>
                <div>
                  <p className="text-slate-900 dark:text-white font-bold">Add review photos</p>
                  <p className="text-slate-500 text-sm mt-1">Drag and drop or click to browse</p>
                </div>
                <p className="text-slate-400 text-xs mt-4">JPG, PNG, WEBP (Max 5MB per file)</p>
              </div>

              {reviewPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 mt-2">
                  {reviewPhotos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 overflow-hidden group">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.previewUrl} className="w-full h-full object-cover" alt="Upload preview" />

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
                              onClick={(e) => { e.stopPropagation(); uploadReviewPhoto(photo); }}
                              className="mt-2 px-2 py-1 bg-white text-slate-900 rounded text-[10px] font-bold hover:bg-slate-100"
                            >
                              Retry
                            </button>
                          </div>
                        )}

                        {(photo.status === 'success' || photo.status === 'idle') && (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeReviewPhoto(photo.id); }}
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
                  disabled={
                    isSubmitting ||
                    reviewPhotos.some((photo) => photo.status === "uploading") ||
                    productPhoto?.status === "uploading" ||
                    (isNewProductFlow && !confirmNewProduct)
                  }
                  className="flex-1 sm:flex-none h-12 px-10 rounded-lg bg-primary text-white font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                >
                  {isSubmitting ? "Publishing..." : "Publish Review"}
                </button>
              </div>
            </div>
          </form>
        </div>

        <p className="text-center text-slate-400 dark:text-slate-600 text-[11px] py-4">
          By publishing, you agree to UserReview&apos;s Terms of Service and Privacy Policy.
        </p>
      </div>
    </main>
  );
}
