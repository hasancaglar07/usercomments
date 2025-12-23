"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SUPPORTED_LANGUAGES,
  normalizeLanguage,
  replaceLanguageInPath,
  type SupportedLanguage,
} from "@/src/lib/i18n";
import { t, type TranslationKey } from "@/src/lib/copy";

type LanguageSwitcherProps = {
  currentLang: SupportedLanguage;
  label?: string;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
};

export default function LanguageSwitcher({
  currentLang,
  label,
  className,
  labelClassName,
  selectClassName,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextLang = normalizeLanguage(event.target.value);
    const query = searchParams?.toString();
    const basePath = pathname ?? "/";
    const pathWithQuery = query ? `${basePath}?${query}` : basePath;
    const nextPath = replaceLanguageInPath(pathWithQuery, nextLang);
    router.push(nextPath);
  };

  const languageNameKeys: Record<SupportedLanguage, TranslationKey> = {
    tr: "language.name.tr",
    en: "language.name.en",
    es: "language.name.es",
    de: "language.name.de",
    ar: "language.name.ar",
  };
  const resolvedLabel = label ?? t(currentLang, "language.label");

  return (
    <div className={className}>
      {resolvedLabel ? (
        <span className={labelClassName}>{resolvedLabel}</span>
      ) : null}
      <select
        className={selectClassName}
        value={currentLang}
        onChange={handleChange}
        aria-label={resolvedLabel || t(currentLang, "language.label")}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {t(currentLang, languageNameKeys[lang]) ?? lang.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
