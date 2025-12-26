This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Environment

Create `apps/web/.env.local` with:

- `NEXT_PUBLIC_API_BASE_URL` (Worker origin, no `/api` suffix; example: `https://api.example.com`)
- `NEXT_PUBLIC_SITE_URL` (example: `https://example.com`)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_ALLOW_MOCK_FALLBACK` (`false` in production)

## Internationalization (i18n)

- All public routes are language-prefixed under `/{lang}/...` (App Router: `app/(site)/[lang]`).
- Default language is detected from browser/region (Accept-Language + geo). Missing or unknown prefixes redirect to the detected language (fallback: `/en`).
- Arabic uses RTL layout (`dir="rtl"`).
- Review slugs are language-specific (`review_translations.slug`). `/[lang]/content/[slug]` resolves by `lang` and redirects to `/en/...` when a translation is missing.
- Category routes use IDs (`/catalog/reviews/[id]`) while names come from `category_translations`.

### Add a new language

1) Add the language code to `SUPPORTED_LANGUAGES` in `apps/web/src/lib/i18n.ts`.
2) Add the same language code to `workers/api/src/utils/i18n.ts`.
3) Ensure translations exist in `review_translations` and `category_translations`.
4) Verify `/sitemap.xml` and hreflang output; update `docs/seo-i18n.md` if needed.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Build Troubleshooting (lightningcss)

Supported Node versions: 18 or 20.

If `npm run build` fails with a missing `lightningcss-<platform>` binary, it usually means `node_modules` was created on a different OS (Windows vs Linux/WSL).

Clean install steps:

```bash
rm -rf node_modules package-lock.json
npm install
```

If you switch between Windows and WSL/Linux, delete `node_modules` and reinstall in the target OS so the correct `lightningcss` binary is installed.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Cloudflare Pages

We deploy the web app to Cloudflare Pages using the OpenNext adapter.

High-level steps:

1) Build with `opennextjs-cloudflare` (`npx opennextjs-cloudflare build`).
2) Deploy the generated output to Cloudflare Pages.
3) Configure `NEXT_PUBLIC_API_BASE_URL` to your Worker domain.

See `docs/deploy-cloudflare.md` for the exact commands and environment setup.
