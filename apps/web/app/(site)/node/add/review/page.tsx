import AddReviewClient from "@/components/reviews/AddReviewClient";
import { getCategories } from "@/src/lib/api";
import type { Category } from "@/src/types";
import { allowMockFallback } from "@/src/lib/runtime";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCategoryOptions(categories: Category[]): string {
  return categories
    .map(
      (category) =>
        `<option value="${category.id}">${escapeHtml(category.name)}</option>`
    )
    .join("");
}

export default async function Page() {
  const apiConfigured = Boolean(process.env.NEXT_PUBLIC_API_BASE_URL);
  let categoryOptionsHtml = allowMockFallback
    ? `
<option value="tech">Technology &amp; Electronics</option>
<option value="beauty">Beauty &amp; Health</option>
<option value="travel">Travel &amp; Hotels</option>
<option value="auto">Auto &amp; Moto</option>
<option value="movies">Movies &amp; Books</option>
`
    : "";
  let hasCategories = allowMockFallback;
  let errorMessage: string | null = null;

  if (apiConfigured) {
    try {
      const categories = await getCategories();
      const topLevel = categories.filter((category) => !category.parentId);
      if (topLevel.length > 0) {
        categoryOptionsHtml = buildCategoryOptions(topLevel);
        hasCategories = true;
      }
    } catch {
      if (!allowMockFallback) {
        errorMessage = "Unable to load categories. Please try again later.";
      }
    }
  } else if (!allowMockFallback) {
    errorMessage = "API base URL is not configured.";
  }

  if (!hasCategories && !allowMockFallback && !errorMessage) {
    errorMessage = "Categories are unavailable.";
  }

  const selectDisabledAttr = hasCategories ? "" : " disabled";
  const errorBannerHtml = errorMessage
    ? `<div class="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">${escapeHtml(
        errorMessage
      )}</div>`
    : "";

  const bodyHtml = `
<!-- Top Navigation Bar -->

<main class="flex-1 flex justify-center py-8 px-4 sm:px-6">
<div class="layout-content-container flex flex-col max-w-[960px] w-full flex-1 gap-6">
${errorBannerHtml}
<!-- Page Heading -->
<div class="flex flex-wrap justify-between gap-3 px-4">
<div class="flex min-w-72 flex-col gap-2">
<p class="text-slate-900 dark:text-white text-4xl font-black leading-tight tracking-[-0.033em]">Write a Review</p>
<p class="text-slate-500 dark:text-slate-400 text-base font-normal leading-normal">Share your experience with the community</p>
</div>
</div>
<!-- Main Form Card -->
<div class="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 md:p-8">
<form class="flex flex-col gap-8" data-review-form>
<!-- Section 1: Product Details -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<label class="flex flex-col flex-1 gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Category</span>
<div class="relative">
<select class="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base font-normal leading-normal appearance-none cursor-pointer" data-review-category${selectDisabledAttr}>
<option disabled="" selected="" value="">Select a category</option>
${categoryOptionsHtml}
</select>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
<span class="material-symbols-outlined">expand_more</span>
</div>
</div>
</label>
<label class="flex flex-col flex-1 gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Subcategory</span>
<div class="relative">
<select class="form-select flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base font-normal leading-normal appearance-none cursor-pointer" data-review-subcategory disabled>
<option disabled="" selected="" value="">Select a category first</option>
</select>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
<span class="material-symbols-outlined">expand_more</span>
</div>
</div>
</label>
<label class="flex flex-col flex-1 gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Product / Service Name</span>
<div class="relative">
<input class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base font-normal leading-normal placeholder:text-slate-400" placeholder="What are you reviewing?" value="" data-review-product/>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-400">
<span class="material-symbols-outlined text-[20px]">search</span>
</div>
</div>
</label>
</div>
<div class="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>
<!-- Section 2: Review Title & Rating -->
<div class="flex flex-col gap-6">
<label class="flex flex-col flex-1 gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Review Title</span>
<input class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 h-12 px-4 text-base font-normal leading-normal placeholder:text-slate-400 font-medium" placeholder="Summarize your experience in a headline" value="" data-review-title/>
</label>
<div class="flex flex-col gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Your Rating</span>
<div class="flex items-center gap-1 group/rating">
<button class="text-yellow-400 hover:scale-110 transition-transform focus:outline-none" type="button" data-rating-value="1">
<span class="material-symbols-outlined text-[32px] fill-current" style="font-variation-settings: 'FILL' 1;">star</span>
</button>
<button class="text-yellow-400 hover:scale-110 transition-transform focus:outline-none" type="button" data-rating-value="2">
<span class="material-symbols-outlined text-[32px] fill-current" style="font-variation-settings: 'FILL' 1;">star</span>
</button>
<button class="text-yellow-400 hover:scale-110 transition-transform focus:outline-none" type="button" data-rating-value="3">
<span class="material-symbols-outlined text-[32px] fill-current" style="font-variation-settings: 'FILL' 1;">star</span>
</button>
<button class="text-yellow-400 hover:scale-110 transition-transform focus:outline-none" type="button" data-rating-value="4">
<span class="material-symbols-outlined text-[32px] fill-current" style="font-variation-settings: 'FILL' 1;">star</span>
</button>
<button class="text-slate-300 dark:text-slate-600 hover:text-yellow-400 hover:scale-110 transition-all focus:outline-none" type="button" data-rating-value="5">
<span class="material-symbols-outlined text-[32px]">star</span>
</button>
<span class="ml-3 text-slate-500 dark:text-slate-400 text-sm font-medium" data-rating-display>4.0 / 5.0</span>
</div>
</div>
</div>
<!-- Section 3: Pros & Cons -->
<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
<label class="flex flex-col flex-1 gap-2">
<span class="text-green-600 dark:text-green-400 text-base font-semibold leading-normal flex items-center gap-2">
<span class="material-symbols-outlined text-sm">add_circle</span> Pros
                            </span>
<textarea class="form-textarea flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-green-500/30 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-h-[100px] p-4 text-base font-normal leading-normal placeholder:text-slate-400" placeholder="What did you like? (One per line)" data-review-pros></textarea>
</label>
<label class="flex flex-col flex-1 gap-2">
<span class="text-red-500 dark:text-red-400 text-base font-semibold leading-normal flex items-center gap-2">
<span class="material-symbols-outlined text-sm">do_not_disturb_on</span> Cons
                            </span>
<textarea class="form-textarea flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 dark:text-white focus:outline-0 focus:ring-2 focus:ring-red-500/30 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 min-h-[100px] p-4 text-base font-normal leading-normal placeholder:text-slate-400" placeholder="What could be improved? (One per line)" data-review-cons></textarea>
</label>
</div>
<!-- Section 4: Rich Text Editor -->
<div class="flex flex-col gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Your Review</span>
<div class="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden focus-within:ring-2 focus-within:ring-primary/50 focus-within:border-primary">
<!-- Toolbar -->
<div class="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900">
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Bold" type="button">
<span class="material-symbols-outlined text-[20px]">format_bold</span>
</button>
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Italic" type="button">
<span class="material-symbols-outlined text-[20px]">format_italic</span>
</button>
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Underline" type="button">
<span class="material-symbols-outlined text-[20px]">format_underlined</span>
</button>
<div class="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2"></div>
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Bullet List" type="button">
<span class="material-symbols-outlined text-[20px]">format_list_bulleted</span>
</button>
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Numbered List" type="button">
<span class="material-symbols-outlined text-[20px]">format_list_numbered</span>
</button>
<div class="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2"></div>
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Insert Link" type="button">
<span class="material-symbols-outlined text-[20px]">link</span>
</button>
<button class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors" title="Insert Image" type="button">
<span class="material-symbols-outlined text-[20px]">image</span>
</button>
</div>
<!-- Text Area -->
<textarea class="w-full h-80 p-4 bg-transparent border-none outline-none resize-y text-base text-slate-900 dark:text-white placeholder:text-slate-400" placeholder="Tell us about your experience. What did you like or dislike? Would you recommend it?" data-review-body></textarea>
</div>
</div>
<!-- Section 5: Photo Upload -->
<div class="flex flex-col gap-2">
<span class="text-slate-900 dark:text-white text-base font-semibold leading-normal">Photos</span>
<div class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group/upload" data-upload-zone>
<div class="size-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-3 group-hover/upload:scale-110 transition-transform">
<span class="material-symbols-outlined text-primary text-[28px]">cloud_upload</span>
</div>
<p class="text-slate-900 dark:text-white text-sm font-medium" data-upload-status>Click to upload or drag and drop</p>
<p class="text-slate-500 dark:text-slate-400 text-xs mt-1">SVG, PNG, JPG or GIF (max. 5MB)</p>
</div>
<input class="sr-only" type="file" data-upload-input multiple="" accept="image/*"/>
<!-- Uploaded Image Previews -->
<div class="flex gap-4 mt-2 overflow-x-auto pb-2" data-upload-previews>
<div class="relative group/image shrink-0">
<div class="size-20 rounded-lg bg-cover bg-center border border-slate-200 dark:border-slate-700" data-alt="Preview of uploaded product photo showing packaging" style="background-image: url('/stitch_assets/images/img-002.png')"></div>
<button class="absolute -top-2 -right-2 size-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity shadow-sm" type="button">
<span class="material-symbols-outlined text-[14px]">close</span>
</button>
</div>
<div class="relative group/image shrink-0">
<div class="size-20 rounded-lg bg-cover bg-center border border-slate-200 dark:border-slate-700" data-alt="Preview of uploaded product photo showing side view" style="background-image: url('/stitch_assets/images/img-003.png')"></div>
<button class="absolute -top-2 -right-2 size-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity shadow-sm" type="button">
<span class="material-symbols-outlined text-[14px]">close</span>
</button>
</div>
</div>
</div>
<div class="h-px bg-slate-100 dark:bg-slate-800 w-full my-2"></div>
<!-- Bottom Actions -->
<div class="flex flex-col sm:flex-row items-center justify-between gap-6">
<label class="flex items-center gap-3 cursor-pointer select-none">
<div class="relative">
<input checked="" class="peer sr-only" type="checkbox"/>
<div class="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
</div>
<span class="text-slate-900 dark:text-white text-sm font-medium">I recommend this product</span>
</label>
<div class="flex gap-4 w-full sm:w-auto">
<button class="flex-1 sm:flex-none h-12 px-6 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" type="button">
                                Save Draft
                            </button>
<button class="flex-1 sm:flex-none h-12 px-8 rounded-lg bg-primary text-white font-bold text-sm hover:bg-blue-600 transition-colors shadow-lg shadow-blue-500/30" type="submit" data-review-submit>
                                Publish Review
                            </button>
</div>
</div>
</form>
</div>
<p class="text-center text-slate-400 dark:text-slate-600 text-xs py-4">
                By publishing, you agree to iRecommend's Terms of Service and Privacy Policy.
            </p>
</div>
</main>
`;

  return (
    <>
      <AddReviewClient />
      <div
        className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white overflow-x-hidden min-h-screen flex flex-col"
        data-page="add-review"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );
}
