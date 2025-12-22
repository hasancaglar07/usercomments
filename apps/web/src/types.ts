export type Review = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  contentHtml?: string;
  ratingAvg?: number;
  ratingCount?: number;
  votesUp?: number;
  votesDown?: number;
  photoCount?: number;
  photoUrls?: string[];
  author: {
    username: string;
    displayName?: string;
  };
  createdAt: string;
  categoryId?: number;
  subCategoryId?: number;
};

export type UserProfile = {
  username: string;
  displayName?: string;
  bio?: string;
  profilePicUrl?: string;
  stats?: {
    reviewCount?: string;
    totalViews?: string;
    reputation?: string;
    karma?: string;
    rank?: string;
    location?: string;
  };
};

export type Category = {
  id: number;
  name: string;
  parentId?: number | null;
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
};

export type StarType = "full" | "half" | "empty";
