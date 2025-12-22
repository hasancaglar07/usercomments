import type { UserProfile } from "@/src/types";
import type {
  CatalogTopAuthor,
  CategoryTopAuthor,
  HomepageTopReviewer,
} from "@/components/layout/Sidebar";

export const homepageTopReviewers: HomepageTopReviewer[] = [
  {
    profile: { username: "jessica_m", displayName: "Jessica M." },
    avatarUrl: "/stitch_assets/images/img-038.png",
    avatarAlt: "Profile picture of top reviewer 1",
    rankLabel: "#1",
    reviewCountLabel: "1,240 Reviews",
  },
  {
    profile: { username: "david_k", displayName: "David K." },
    avatarUrl: "/stitch_assets/images/img-039.png",
    avatarAlt: "Profile picture of top reviewer 2",
    rankLabel: "#2",
    reviewCountLabel: "982 Reviews",
  },
  {
    profile: { username: "anna_s", displayName: "Anna S." },
    avatarUrl: "/stitch_assets/images/img-040.png",
    avatarAlt: "Profile picture of top reviewer 3",
    rankLabel: "#3",
    reviewCountLabel: "845 Reviews",
  },
];

export const catalogTopAuthors: CatalogTopAuthor[] = [
  {
    profile: { username: "alexreviews", displayName: "AlexReviews" },
    avatarUrl: "/stitch_assets/images/img-008.png",
    avatarAlt: "User Avatar 1",
    avatarDataAlt: "Avatar of user 1",
    rankLabel: "#1",
    rankClassName:
      "absolute -bottom-1 -right-1 bg-yellow-400 text-[8px] font-bold text-slate-900 px-1 rounded-full",
    reviewsLabel: "14 reviews",
    karmaLabel: "890 karma",
  },
  {
    profile: { username: "beautyqueen_99", displayName: "BeautyQueen_99" },
    avatarUrl: "/stitch_assets/images/img-009.png",
    avatarAlt: "User Avatar 2",
    avatarDataAlt: "Avatar of user 2",
    rankLabel: "#2",
    rankClassName:
      "absolute -bottom-1 -right-1 bg-slate-300 text-[8px] font-bold text-slate-900 px-1 rounded-full",
    reviewsLabel: "9 reviews",
    karmaLabel: "650 karma",
  },
  {
    profile: { username: "gamingpro", displayName: "GamingPro" },
    avatarUrl: "/stitch_assets/images/img-010.png",
    avatarAlt: "User Avatar 3",
    avatarDataAlt: "Avatar of user 3",
    rankLabel: "#3",
    rankClassName:
      "absolute -bottom-1 -right-1 bg-orange-700 text-[8px] font-bold text-white px-1 rounded-full",
    reviewsLabel: "7 reviews",
    karmaLabel: "420 karma",
  },
];

export const categoryTopAuthors: CategoryTopAuthor[] = [
  {
    profile: { username: "beautyguru_kate", displayName: "BeautyGuru_Kate" },
    avatarUrl: "/stitch_assets/images/img-026.png",
    avatarAlt: "Woman avatar",
    reviewsLabel: "156 reviews",
  },
  {
    profile: { username: "alexreviewer", displayName: "AlexReviewer" },
    avatarUrl: "/stitch_assets/images/img-027.png",
    avatarAlt: "Man avatar",
    reviewsLabel: "98 reviews",
  },
];

export const profileUser: UserProfile = {
  username: "jane_doe",
  displayName: "Jane Doe",
  bio: "Passionate about tech gadgets and skincare products. I believe in honest, detailed reviews to help others make informed decisions. Currently testing the latest flagship phones. 📸 📱",
  profilePicUrl: "/stitch_assets/images/img-057.png",
  stats: {
    reviewCount: "142",
    totalViews: "54k",
    reputation: "+1,203",
    location: "San Francisco, CA",
  },
};
