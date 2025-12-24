import { SUPPORTED_LANGUAGES } from "@/src/lib/i18n";

export function generateStaticParams() {
    return SUPPORTED_LANGUAGES.map((lang) => ({ lang }));
}

export default function LangLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return children;
}
