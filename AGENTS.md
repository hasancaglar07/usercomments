\# AGENTS.md

review - Next.js 16.1 (React 19, TypeScript, Tailwind v4) in `apps/web`; Cloudflare Workers (TypeScript) in `workers/api`; deploy target is Cloudflare Pages (web) + Cloudflare Workers (api). Supabase for DB/Auth, Backblaze B2 for images. Node 20 LTS target.

Follows \[MCAF](https://mcaf.managed-code.com/)

---

\## Conversations (Self-Learning)

Learn the user's habits, preferences, and working style. Extract rules from conversations, save to "## Rules to follow", and generate code according to the user's personal rules.

\*\*Update requirement (core mechanism):\*\*

Before doing ANY task, evaluate the latest user message.  
If you detect a new rule, correction, preference, or change → update `agents.md` first.  
Only after updating the file you may produce the task output.  
If no new rule is detected → do not update the file.

\*\*When to extract rules:\*\*

\- prohibition words (never, don't, stop, avoid) or similar → add NEVER rule
\- requirement words (always, must, make sure, should) or similar → add ALWAYS rule
\- memory words (remember, keep in mind, note that) or similar → add rule
\- process words (the process is, the workflow is, we do it like) or similar → add to workflow
\- future words (from now on, going forward) or similar → add permanent rule

\*\*Preferences → add to Preferences section:\*\*

\- positive (I like, I prefer, this is better) or similar → Likes
\- negative (I don't like, I hate, this is bad) or similar → Dislikes
\- comparison (prefer X over Y, use X instead of Y) or similar → preference rule

\*\*Corrections → update or add rule:\*\*

\- error indication (this is wrong, incorrect, broken) or similar → fix and add rule
\- repetition frustration (don't do this again, you ignored, you missed) or similar → emphatic rule
\- manual fixes by user → extract what changed and why

\*\*Strong signal (add IMMEDIATELY):\*\*

\- swearing, frustration, anger, sarcasm → critical rule
\- ALL CAPS, excessive punctuation (!!!, ???) → high priority
\- same mistake twice → permanent emphatic rule
\- user undoes your changes → understand why, prevent

\*\*Ignore (do NOT add):\*\*

\- temporary scope (only for now, just this time, for this task) or similar
\- one-off exceptions
\- context-specific instructions for current task only

\*\*Rule format:\*\*

\- One instruction per bullet
\- Tie to category (Testing, Code, Docs, etc.)
\- Capture WHY, not just what
\- Remove obsolete rules when superseded

---

\## Rules to follow (Mandatory, no exceptions)

\### Commands

\- web dev: `cd apps/web && npm run dev`
\- web build: `cd apps/web && npm run build`
\- web test: not configured
\- web format: not configured
\- web lint: `cd apps/web && npm run lint`
\- workers dev: `cd workers/api && npm run dev`
\- workers deploy: `cd workers/api && npm run deploy`
\- workers lint: not configured

\### Task Delivery (ALL TASKS)

\- Read `proje.md` and relevant `stitch_homepage/*/code.html` before any UI work
\- Read `docs/deploy-cloudflare.md` and `docs/geliştirme.md` before starting tasks to align delivery with deployment/dev constraints
\- Süreç: Önce eksikleri tespit edip planla, ardından uygula; böylece ilerleme net takip edilir
\- Süreç: En hızlı, en stabil ve en düzgün sonuç için önce düşün, araştır, planla; ardından uygula
\- Preserve pixel-perfect markup and class names; do not change UI markup unless explicitly requested
\- Web changes stay in App Router (`apps/web/app`) and shared layout in `apps/web/components/layout`
\- API lives in `workers/api` and uses Supabase server-side client
\- Cache-first for read endpoints; rate-limit write endpoints
\- Keep API response shapes consistent (`{ items, pageInfo }` and `{ items, nextCursor }`)
\- Admin API endpoints should be admin-only for now to reduce moderation risk
\- Admin UI: Provide a user-focused, advanced admin design with full content visibility/editing and optional bulk actions, because admins must manage content end-to-end
\- No deploy configs for Vercel/VDS/nginx/systemd/pm2 in active use
\- Env separation: `NEXT_PUBLIC_*` only for browser; secrets in worker env
\- Git history not available (no .git). If initializing repo, use Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`

\### Documentation (ALL TASKS)

\- Project docs in `docs/` (`docs/ADR.md`, `docs/futuretemplate.md`)
\- App docs in `apps/web/README.md` and `docs/deploy-cloudflare.md`
\- Legacy docs archived in `docs/archive/express-api/` and `docs/archive/vds-deploy/`
\- SQL migrations in `docs/archive/express-api/db/` run in order: `schema.sql` then `search.sql` then `moderation.sql`
\- Cloudflare deploy docs live in `docs/deploy-cloudflare.md`

\### Testing (ALL TASKS)

\- No automated tests or test scripts configured today
\- Target approach if tests are added: Playwright for web smoke checks and supertest for API integration with a real DB or Supabase test project
\- For now, use `npm run lint` and `npm run build` in touched apps as smoke checks

\### Autonomy

\- Start work immediately and proceed unless blocked
\- Ask before changing API contracts, adding dependencies, or modifying DB schema/migrations
\- Use Zod for web form validation to prevent invalid submissions from reaching the API

\### Code Style

\- TypeScript everywhere with strict mode enabled
\- Web: Next.js App Router under `apps/web/app`, components in `apps/web/components`, helpers in `apps/web/src/lib`, types in `apps/web/src/types.ts`, path alias `@/`; Tailwind v4 configured via `apps/web/styles/globals.css` and `postcss.config.mjs` (no tailwind.config file)
\- Web runtime: OpenNext adapter does not support `export const runtime = 'edge'`; remove it to ensure builds succeed
\- Web API: `apps/web/src/lib/api.ts` must use `NEXT_PUBLIC_API_BASE_URL` to reach the Worker API (no direct DB calls from the web app)
\- Auth: use supabase-js client directly for web auth flows to align with Supabase Auth
\- Storage: keep image files in Backblaze B2 and persist their metadata in the DB for queryable content
\- API: Cloudflare Workers in `workers/api/src` with route handlers and shared utilities; Zod for validation; use Supabase server-side client
\- DB: create profiles on signup via a Supabase DB trigger for reliability
\- Naming: PascalCase for components/types; camelCase for functions/variables; file names match feature (e.g., `reviewsController.ts`)
\- Types are duplicated in `apps/web/src/types.ts` and `workers/api/src/types.ts`; keep them in sync when API shapes change
\- API responses: list endpoints return `{ items, pageInfo }`, cursor endpoints return `{ items, nextCursor }`, health returns `{ ok, timestamp }`
\- Web UI must be JSX/TSX only; avoid `dangerouslySetInnerHTML` or HTML strings to keep rendering safe and predictable
\- Internal navigation must use `next/link` `Link` to prevent full page reloads
\- Replace DOM manipulation (`document.querySelector`, `addEventListener`) with React state or refs to keep components declarative
\- UI copy must be English to ensure consistent language across the app
\- Use `'use client'` only when interactivity is required to avoid unnecessary client components
\- Default language is `en`, and missing translations must redirect to `/en` for SEO consistency
\- i18n SEO: each locale must serve locale-specific content and sitemaps so search engines index the correct language

\### Critical (NEVER violate)

\- Never commit secrets, keys, or connection strings
\- Never modify files under `stitch_homepage/` (pixel-perfect HTML source of truth)
\- Never change UI markup/layout unless explicitly requested; preserve pixel-perfect design
\- Never alter SQL migration order without updating docs
\- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser
\- Never enable mock fallback in production

\### Boundaries

\*\*Always:\*\*

\- Read `proje.md` and compare to `stitch_homepage/*/code.html` before changing UI
\- Keep shared Header/Footer in `apps/web/components/layout` as the canonical markup
\- Keep `public/stitch_assets` paths intact and consistent with HTML source
\- Keep env variable names consistent across `.env.example` and `.env.production.example`
\- Keep Worker secrets in Cloudflare env, not in web bundles
\- Prefer caching for read endpoints to reduce Supabase load

\*\*Ask first:\*\*

\- Changing public API contracts or response shapes
\- Adding new dependencies
\- Modifying DB schema or SQL migration files in `apps/api/db/`
\- Deleting files or changing archived deploy configs in `docs/archive/vds-deploy/`

---

\## Preferences

\### Likes

\- İletişim: Yanıtları Türkçe ver, çünkü kullanıcı bunu tercih ediyor.
\- Quality: Prefer advanced, production-grade, fully professional implementations because the user expects a very polished, pro-ready product.
\- SEO: SEO kritik; mümkün olduğunca SSR/SSG ve sitemap doğruluğunu koru.

\### Dislikes

\- None noted yet
