import type { Metadata } from "next";
import UserSettingsClient from "@/components/user/UserSettingsClient";
import { buildMetadata } from "@/src/lib/seo";

export const runtime = "edge";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Profile Settings",
    description: "Update your profile details and avatar.",
    path: "/user/settings",
    type: "website",
  });
}

export default function Page() {
  return <UserSettingsClient />;
}
