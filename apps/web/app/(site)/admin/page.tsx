import type { Metadata } from "next";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { buildMetadata } from "@/src/lib/seo";

export const runtime = "edge";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Admin Dashboard",
    description: "Manage categories, moderation, and reports.",
    path: "/admin",
    type: "website",
  });
}

export default function Page() {
  return <AdminDashboardClient />;
}
