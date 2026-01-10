import { getReviewBySlugDirect } from "@/src/lib/api-direct";
import { normalizeLanguage } from "@/src/lib/i18n";
import { getSupabaseClient } from "@/src/lib/supabase";

export const runtime = 'edge';

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
    const { lang } = await params;
    const p = await params;

    // Hardcoded test slug - replace with a known good slug
    const testSlug = "evangeligin-lutherci-katedralinde-sansolye-petek-ve-paulus-konseri-yorumlari";

    const start = Date.now();
    let result = null;
    let error = null;
    let envCheck = null;

    try {
        const client = getSupabaseClient();
        envCheck = {
            ok: !!client,
            urlConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            anonConfigured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        };

        result = await getReviewBySlugDirect(testSlug, normalizeLanguage(p.lang));
    } catch (e: any) {
        error = e.message + (e.stack ? `\n${e.stack}` : '');
    }
    const end = Date.now();

    return (
        <div className="p-10 font-mono text-sm whitespace-pre-wrap">
            <h1>Debug Page</h1>
            <div>Time: {end - start}ms</div>
            <div>Lang: {lang}</div>
            <div>Slug: {testSlug}</div>

            <h2 className="mt-4 font-bold">Environment Check</h2>
            <div>{JSON.stringify(envCheck, null, 2)}</div>

            <h2 className="mt-4 font-bold">Result</h2>
            {result ? (
                <div className="text-green-600">
                    Found Review:
                    ID: {result.id}
                    Title: {result.title}
                </div>
            ) : (
                <div className="text-orange-500">Result is null (Not Found)</div>
            )}

            {error && (
                <>
                    <h2 className="mt-4 font-bold text-red-600">Error</h2>
                    <div className="text-red-600">{error}</div>
                </>
            )}
        </div>
    );
}
