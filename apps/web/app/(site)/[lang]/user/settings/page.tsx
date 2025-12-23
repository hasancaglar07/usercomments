import type { Metadata } from "next";
import UserSettingsClient from "@/components/user/UserSettingsClient";
import { buildMetadata } from "@/src/lib/seo";
import { normalizeLanguage } from "@/src/lib/i18n";


type UserSettingsPageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata(
  props: UserSettingsPageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  return buildMetadata({
    title: "Profile Settings",
    description: "Update your profile details and avatar.",
    path: "/user/settings",
    lang,
    type: "website",
  });
}

export default function Page() {
  return <UserSettingsClient />;
}
