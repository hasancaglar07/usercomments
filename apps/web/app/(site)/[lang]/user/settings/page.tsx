import type { Metadata } from "next";
import UserSettingsClient from "@/components/user/UserSettingsClient";
import { buildMetadata } from "@/src/lib/seo";
import { normalizeLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";


type UserSettingsPageProps = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata(
  props: UserSettingsPageProps
): Promise<Metadata> {
  const params = await props.params;
  const lang = normalizeLanguage(params.lang);
  const title = t(lang, "settings.title");
  const description = t(lang, "settings.subtitle");
  const metadata = buildMetadata({
    title,
    description,
    path: "/user/settings",
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
  return <UserSettingsClient />;
}
