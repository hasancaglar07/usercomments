import type { Metadata } from "next";
import AdminDashboardClient from "@/components/admin/AdminDashboardClient";
import { buildMetadata } from "@/src/lib/seo";
import { normalizeLanguage } from "@/src/lib/i18n";


type AdminPageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata(
  props: AdminPageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const metadata = buildMetadata({
    title: "Admin Dashboard",
    description: "Manage categories, moderation, and reports.",
    path: "/admin",
    lang,
    type: "website",
  });
  return {
    ...metadata,
    robots: {
      index: false,
      follow: true,
    },
  };
}

export default function Page() {
  return <AdminDashboardClient />;
}
