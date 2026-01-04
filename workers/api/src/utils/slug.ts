const TRANSLITERATION_MAP: Record<string, string> = {
  "\u00c4": "A",
  "\u00e4": "a",
  "\u00d6": "O",
  "\u00f6": "o",
  "\u00dc": "U",
  "\u00fc": "u",
  "\u00df": "ss",
  "\u00c7": "C",
  "\u00e7": "c",
  "\u011e": "G",
  "\u011f": "g",
  "\u0130": "I",
  "\u0131": "i",
  "\u015e": "S",
  "\u015f": "s",
  "\u00d1": "N",
  "\u00f1": "n",
  "\u00c6": "AE",
  "\u00e6": "ae",
  "\u00d8": "O",
  "\u00f8": "o",
  "\u0152": "OE",
  "\u0153": "oe",
};

export function slugify(value: string): string {
  const normalized = value.normalize("NFKD");
  let ascii = "";

  for (const char of normalized) {
    const mapped = TRANSLITERATION_MAP[char];
    if (mapped !== undefined) {
      ascii += mapped;
      continue;
    }

    const code = char.charCodeAt(0);
    if (code >= 0x0300 && code <= 0x036f) {
      continue;
    }

    ascii += char;
  }

  return ascii
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LANGUAGE_SUFFIXES: Record<string, string> = {
  tr: "-yorumlar",
  en: "-reviews",
  de: "-test",
  es: "-opiniones",
  fr: "-avis",
  it: "-opinioni",
  ru: "-otzyvy",
  pt: "-avaliacao",
  nl: "-review",
};

export function createLocalizedSlug(name: string, lang: string): string {
  const slug = slugify(name);

  // If slug became empty (e.g. unsupported charset), fallback to generic timestamp
  if (!slug) return "";

  const suffix = LANGUAGE_SUFFIXES[lang];

  if (!suffix) {
    return slug;
  }

  const reviewKeywords = new Set([
    "review",
    "reviews",
    "yorum",
    "yorumlar",
    "yorumlari",
    "test",
    "tests",
    "opiniones",
    "opinion",
    "avis",
    "revue",
    "opinioni",
    "opinione",
    "avaliacao",
    "avaliacoes",
  ]);
  const parts = slug.split("-").filter(Boolean);
  while (parts.length > 0 && reviewKeywords.has(parts[parts.length - 1])) {
    parts.pop();
  }
  const base = parts.join("-");
  if (!base) {
    return suffix.replace(/^-/, "");
  }
  return `${base}${suffix}`;
}
