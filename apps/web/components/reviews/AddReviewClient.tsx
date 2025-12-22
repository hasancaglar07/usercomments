"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createReview, presignUpload } from "@/src/lib/api-client";
import { getSubcategories } from "@/src/lib/api";
import { ensureAuthLoaded, getAccessToken } from "@/src/lib/auth";

type UploadItem = {
  url: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatParagraphs(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const escaped = escapeHtml(trimmed);
  const paragraphs = escaped.split(/\n\s*\n/);
  return paragraphs
    .map(
      (paragraph) =>
        `<p class="text-slate-600 dark:text-slate-300 leading-relaxed mb-6">${paragraph.replace(
          /\n/g,
          "<br/>"
        )}</p>`
    )
    .join("");
}

function formatList(
  title: string,
  items: string[],
  listClass: string,
  headingClass: string
): string {
  if (items.length === 0) {
    return "";
  }
  const safeItems = items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return `<h3 class="${headingClass}">${escapeHtml(
    title
  )}</h3><ul class="${listClass}">${safeItems}</ul>`;
}

function normalizeList(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function buildExcerpt(value: string, fallback: string): string {
  const source = value.trim() || fallback.trim();
  if (!source) {
    return "Review submitted.";
  }
  const normalized = source.replace(/\s+/g, " ").trim();
  if (normalized.length >= 10) {
    return normalized.length > 160
      ? `${normalized.slice(0, 157)}...`
      : normalized;
  }
  return normalized.padEnd(10, ".");
}

export default function AddReviewClient() {
  const router = useRouter();
  const uploadsRef = useRef<UploadItem[]>([]);
  const isUploadingRef = useRef(false);
  const ratingRef = useRef(4);

  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | undefined;

    const init = async () => {
      await ensureAuthLoaded();
      if (!isMounted) {
        return;
      }
      if (!getAccessToken()) {
        router.replace("/user/login");
        return;
      }

      const form = document.querySelector<HTMLFormElement>("[data-review-form]");
      const categorySelect = document.querySelector<HTMLSelectElement>(
        "[data-review-category]"
      );
      const subCategorySelect = document.querySelector<HTMLSelectElement>(
        "[data-review-subcategory]"
      );
      const productInput = document.querySelector<HTMLInputElement>(
        "[data-review-product]"
      );
      const titleInput = document.querySelector<HTMLInputElement>(
        "[data-review-title]"
      );
      const prosInput = document.querySelector<HTMLTextAreaElement>(
        "[data-review-pros]"
      );
      const consInput = document.querySelector<HTMLTextAreaElement>(
        "[data-review-cons]"
      );
      const bodyInput = document.querySelector<HTMLTextAreaElement>(
        "[data-review-body]"
      );
      const ratingDisplay = document.querySelector<HTMLSpanElement>(
        "[data-rating-display]"
      );
      const ratingButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>("[data-rating-value]")
      );
      const uploadZone = document.querySelector<HTMLElement>(
        "[data-upload-zone]"
      );
      const uploadInput = document.querySelector<HTMLInputElement>(
        "[data-upload-input]"
      );
      const uploadStatus = document.querySelector<HTMLElement>(
        "[data-upload-status]"
      );
      const uploadPreviews = document.querySelector<HTMLElement>(
        "[data-upload-previews]"
      );
      const submitButton = document.querySelector<HTMLButtonElement>(
        "[data-review-submit]"
      );

      if (!form || !categorySelect || !titleInput || !bodyInput) {
        return;
      }

    const setUploadStatus = (message: string) => {
      if (uploadStatus) {
        uploadStatus.textContent = message;
      }
    };

    let subcategoryRequired = false;

    const setSubmitDisabled = (value: boolean) => {
      if (submitButton) {
        submitButton.disabled = value;
      }
    };

    const resetSubcategories = (message: string) => {
      if (!subCategorySelect) {
        return;
      }
      subCategorySelect.innerHTML = `<option disabled="" selected="" value="">${escapeHtml(
        message
      )}</option>`;
      subCategorySelect.disabled = true;
      subcategoryRequired = false;
      setSubmitDisabled(false);
    };

    const populateSubcategories = (items: { id: number; name: string }[]) => {
      if (!subCategorySelect) {
        return;
      }
      if (items.length === 0) {
        resetSubcategories("No subcategories available");
        return;
      }
      const options = items
        .map(
          (item) =>
            `<option value="${item.id}">${escapeHtml(item.name)}</option>`
        )
        .join("");
      subCategorySelect.innerHTML = `<option disabled="" selected="" value="">Select a subcategory</option>${options}`;
      subCategorySelect.disabled = false;
      subcategoryRequired = true;
      setSubmitDisabled(true);
    };

    const updateSubmitState = () => {
      if (!subcategoryRequired || !subCategorySelect) {
        setSubmitDisabled(false);
        return;
      }
      const selected = Number(subCategorySelect.value);
      const hasSelection = Number.isFinite(selected) && selected > 0;
      setSubmitDisabled(!hasSelection);
    };

    const handleCategoryChange = async () => {
      const selectedCategoryId = Number(categorySelect.value);
      if (!selectedCategoryId || Number.isNaN(selectedCategoryId)) {
        resetSubcategories("Select a category first");
        return;
      }
      try {
        const subcategories = await getSubcategories(selectedCategoryId);
        populateSubcategories(subcategories);
      } catch (error) {
        console.error("Failed to load subcategories", error);
        resetSubcategories("Unable to load subcategories");
      }
    };

    const handleSubcategoryChange = () => {
      updateSubmitState();
    };

    const renderPreviews = () => {
      if (!uploadPreviews) {
        return;
      }
      const items = uploadsRef.current;
      if (items.length === 0) {
        uploadPreviews.innerHTML = "";
        return;
      }
      uploadPreviews.innerHTML = items
        .map(
          (item, index) => `
<div class="relative group/image shrink-0">
  <div class="size-20 rounded-lg bg-cover bg-center border border-slate-200 dark:border-slate-700" data-alt="Preview of uploaded product photo" style="background-image: url('${item.url}')"></div>
  <button class="absolute -top-2 -right-2 size-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity shadow-sm" type="button" data-upload-remove="${index}">
    <span class="material-symbols-outlined text-[14px]">close</span>
  </button>
</div>
`
        )
        .join("");
    };

    const applyRating = (value: number) => {
      ratingRef.current = value;
      if (ratingDisplay) {
        ratingDisplay.textContent = `${value.toFixed(1)} / 5.0`;
      }
      ratingButtons.forEach((button) => {
        const buttonValue = Number(button.dataset.ratingValue ?? "0");
        const isFilled = buttonValue <= value;
        button.classList.toggle("text-yellow-400", isFilled);
        button.classList.toggle("text-slate-300", !isFilled);
        button.classList.toggle("dark:text-slate-600", !isFilled);
        const icon = button.querySelector("span");
        if (icon) {
          if (isFilled) {
            icon.setAttribute("style", "font-variation-settings: 'FILL' 1;");
            icon.classList.add("fill-current");
          } else {
            icon.removeAttribute("style");
            icon.classList.remove("fill-current");
          }
        }
      });
    };

    const handleRatingClick = (event: Event) => {
      const target = event.currentTarget as HTMLButtonElement | null;
      if (!target) {
        return;
      }
      const value = Number(target.dataset.ratingValue ?? "0");
      if (Number.isNaN(value) || value <= 0) {
        return;
      }
      applyRating(value);
    };

    const handleUploadClick = () => {
      uploadInput?.click();
    };

    const handleUploadRemove = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const button = target.closest<HTMLButtonElement>("[data-upload-remove]");
      if (!button) {
        return;
      }
      const index = Number(button.dataset.uploadRemove ?? "-1");
      if (Number.isNaN(index) || index < 0) {
        return;
      }
      uploadsRef.current.splice(index, 1);
      renderPreviews();
    };

    const handleUploadChange = async () => {
      if (!uploadInput?.files || uploadInput.files.length === 0) {
        return;
      }
      if (!getAccessToken()) {
        router.replace("/user/login");
        return;
      }
      const files = Array.from(uploadInput.files);
      const maxBytes = 5 * 1024 * 1024;
      const invalidFile = files.find(
        (file) => !file.type.startsWith("image/")
      );
      const oversizedFile = files.find((file) => file.size > maxBytes);
      if (invalidFile) {
        window.alert("Only image files are supported.");
        uploadInput.value = "";
        return;
      }
      if (oversizedFile) {
        window.alert("Each image must be 5MB or smaller.");
        uploadInput.value = "";
        return;
      }
      isUploadingRef.current = true;
      setUploadStatus(`Uploading ${files.length} image(s)...`);

      try {
        for (const file of files) {
          const { uploadUrl, publicUrl } = await presignUpload({
            filename: file.name,
            contentType: file.type || "application/octet-stream",
          });
          const response = await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
          });
          if (!response.ok) {
            throw new Error("Upload failed");
          }
          uploadsRef.current.push({ url: publicUrl });
        }
        renderPreviews();
        setUploadStatus("Upload complete.");
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Upload failed.";
        window.alert(message);
        setUploadStatus("Upload failed. Try again.");
      } finally {
        isUploadingRef.current = false;
        uploadInput.value = "";
      }
    };

    const handleSubmit = async (event: Event) => {
      event.preventDefault();

      if (!getAccessToken()) {
        router.replace("/user/login");
        return;
      }

      if (isUploadingRef.current) {
        window.alert("Please wait for uploads to finish.");
        return;
      }

      const categoryId = Number(categorySelect.value);
      if (!categoryId || Number.isNaN(categoryId)) {
        window.alert("Please select a category.");
        return;
      }

      let subCategoryId: number | undefined;
      if (subcategoryRequired && subCategorySelect) {
        const selected = Number(subCategorySelect.value);
        if (!selected || Number.isNaN(selected)) {
          window.alert("Please select a subcategory.");
          return;
        }
        subCategoryId = selected;
      }

      const title = titleInput.value.trim();
      const productName = productInput?.value.trim() ?? "";
      const prosList = normalizeList(prosInput?.value ?? "");
      const consList = normalizeList(consInput?.value ?? "");
      const bodyText = bodyInput.value.trim();

      if (!title) {
        window.alert("Please enter a review title.");
        return;
      }

      if (!bodyText) {
        window.alert("Please write your review.");
        return;
      }

      const rating = ratingRef.current;
      if (!rating || rating <= 0) {
        window.alert("Please select a rating.");
        return;
      }

      const headingClass = "text-xl font-bold text-slate-900 dark:text-white mb-3";
      const prosListClass =
        "list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 text-sm md:text-base marker:text-green-500 mb-6";
      const consListClass =
        "list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300 text-sm md:text-base marker:text-red-500 mb-6";
      const contentSections = [
        formatList("Pros", prosList, prosListClass, headingClass),
        formatList("Cons", consList, consListClass, headingClass),
        formatParagraphs(bodyText),
      ]
        .filter(Boolean)
        .join("");

      const excerpt = buildExcerpt(bodyText, title || productName);

      try {
        const result = await createReview({
          title,
          excerpt,
          contentHtml: contentSections,
          rating,
          categoryId,
          subCategoryId,
          photoUrls: uploadsRef.current.map((item) => item.url),
        });
        router.push(`/content/${result.slug}`);
      } catch (error) {
        const message =
          error && typeof error === "object" && "message" in error
            ? String(error.message)
            : "Failed to publish review.";
        window.alert(message);
      }
    };

    ratingButtons.forEach((button) => {
      button.addEventListener("click", handleRatingClick);
    });
    categorySelect.addEventListener("change", handleCategoryChange);
    subCategorySelect?.addEventListener("change", handleSubcategoryChange);
    uploadZone?.addEventListener("click", handleUploadClick);
    uploadInput?.addEventListener("change", handleUploadChange);
    uploadPreviews?.addEventListener("click", handleUploadRemove);
    form.addEventListener("submit", handleSubmit);

    resetSubcategories("Select a category first");
    applyRating(ratingRef.current);

      cleanup = () => {
        ratingButtons.forEach((button) => {
          button.removeEventListener("click", handleRatingClick);
        });
        categorySelect.removeEventListener("change", handleCategoryChange);
        subCategorySelect?.removeEventListener("change", handleSubcategoryChange);
        uploadZone?.removeEventListener("click", handleUploadClick);
        uploadInput?.removeEventListener("change", handleUploadChange);
        uploadPreviews?.removeEventListener("click", handleUploadRemove);
        form.removeEventListener("submit", handleSubmit);
      };
    };

    init();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [router]);

  return null;
}
