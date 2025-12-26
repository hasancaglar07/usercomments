export type Review = {
  id: string;
  translationLang?: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml?: string;
  metaTitle?: string;
  metaDescription?: string;
  translations?: {
    lang: string;
    slug: string;
  }[];
  ratingAvg?: number;
  ratingCount?: number;
  views?: number;
  votesUp?: number;
  votesDown?: number;
  photoCount?: number;
  photoUrls?: string[];
  commentCount?: number;
  recommend?: boolean;
  pros?: string[];
  cons?: string[];
  summary?: string;
  faq?: { question: string; answer: string }[];
  specs?: Record<string, string>;
  author: {
    username: string;
    displayName?: string;
    profilePicUrl?: string;
  };
  createdAt: string;
  categoryId?: number;
  subCategoryId?: number;
  productId?: string;
  product?: {
    id: string;
    slug: string;
    name: string;
  };
};

export type ReviewStatus = "published" | "hidden" | "deleted" | "pending" | "draft";
export type ProductStatus = "published" | "hidden" | "deleted" | "pending";
export type BrandStatus = "published" | "hidden" | "deleted" | "pending";
export type UserRole = "user" | "moderator" | "admin";
export type CommentStatus = "published" | "hidden" | "deleted";

export type AdminReview = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml?: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt?: string;
  author: {
    username: string;
    displayName?: string;
    profilePicUrl?: string;
  };
  ratingAvg?: number;
  ratingCount?: number;
  views?: number;
  votesUp?: number;
  votesDown?: number;
  photoUrls?: string[];
  photoCount?: number;
  commentCount?: number;
  recommend?: boolean;
  pros?: string[];
  cons?: string[];
  categoryId?: number;
  subCategoryId?: number;
  productId?: string;
  product?: {
    id: string;
    slug: string;
    name: string;
  };
};

export type AdminComment = {
  id: string;
  reviewId: string;
  text: string;
  status: CommentStatus;
  createdAt: string;
  updatedAt?: string;
  author: {
    username: string;
    displayName?: string;
    profilePicUrl?: string;
  };
  review?: {
    id: string;
    slug: string;
    title: string;
    status?: ReviewStatus;
  };
};

export type AdminUser = {
  userId: string;
  username: string;
  role: UserRole;
  createdAt?: string;
};

export type AdminUserDetail = {
  userId: string;
  username: string;
  role: UserRole;
  createdAt?: string;
  bio?: string;
  profilePicUrl?: string;
};

export type UserProfile = {
  username: string;
  displayName?: string;
  bio?: string;
  profilePicUrl?: string;
  createdAt?: string;
  stats?: {
    reviewCount?: number;
    totalViews?: number;
    reputation?: number;
    karma?: number;
    totalComments?: number;
    rank?: number;
    location?: string;
  };
};

export type LeaderboardMetric = "active" | "helpful" | "trending";
export type LeaderboardTimeframe = "all" | "month" | "week";

export type LeaderboardEntry = {
  profile: UserProfile;
  stats: {
    reviewCount: number;
    totalViews: number;
    reputation: number;
    helpfulVotes?: number;
    recentReviewCount?: number;
    recentHelpfulVotes?: number;
    recentViews?: number;
  };
  rank?: number;
};

export type Category = {
  id: number;
  name: string;
  parentId?: number | null;
};

export type CategoryTranslation = {
  lang: string;
  name: string;
  slug?: string | null;
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
  status?: BrandStatus;
};

export type ProductImage = {
  id: string;
  url: string;
  sortOrder?: number;
};

export type ProductStats = {
  reviewCount?: number;
  ratingAvg?: number;
  ratingCount?: number;
  recommendUp?: number;
  recommendDown?: number;
  photoCount?: number;
};

export type Product = {
  id: string;
  translationLang?: string;
  slug: string;
  name: string;
  description?: string;
  status?: ProductStatus;
  brand?: Brand;
  categoryIds?: number[];
  images?: ProductImage[];
  stats?: ProductStats;
  createdAt?: string;
  updatedAt?: string;
  translations?: {
    lang: string;
    slug: string;
  }[];
};

export type ProductTranslation = {
  lang: string;
  slug: string;
  name: string;
  description?: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
};

export type UploadHealth = {
  ok: boolean;
  checks: {
    r2: {
      configured: boolean;
      missing: string[];
    };
  };
};

export type AdminProduct = Product & {
  status?: ProductStatus;
};

export type PaginationInfo = {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems?: number;
};

export type Comment = {
  id: string;
  reviewId: string;
  text: string;
  createdAt: string;
  author: UserProfile;
  review?: {
    slug: string;
    title: string;
  };
};

export type StarType = "full" | "half" | "empty";

export type ReportStatus = "open" | "resolved" | "rejected";
export type ReportTargetType = "review" | "comment" | "user";

export type Report = {
  id: string;
  reporterUserId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
  createdAt: string;
  status: ReportStatus;
};

export type AdminReportTargetReview = {
  id: string;
  slug: string;
  title: string;
  status: ReviewStatus;
  author?: {
    username: string;
  };
};

export type AdminReportTargetComment = {
  id: string;
  reviewId: string;
  text: string;
  status: CommentStatus;
  reviewSlug?: string;
  reviewTitle?: string;
  author?: {
    username: string;
  };
};

export type AdminReportTargetUser = {
  userId: string;
  username: string;
  role: UserRole;
  profilePicUrl?: string;
  bio?: string;
};

export type AdminReport = Report & {
  target?: {
    review?: AdminReportTargetReview;
    comment?: AdminReportTargetComment;
    user?: AdminReportTargetUser;
  };
};
