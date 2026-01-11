export const runtime = 'edge';

import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";


export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get("code");
    const next = requestUrl.searchParams.get("next") || "/";

    if (code) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseAnonKey) {
            return NextResponse.redirect(new URL("/user/login?error=config", requestUrl.origin));
        }

        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                flowType: "pkce",
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false,
            },
        });

        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
            console.error("OAuth callback error:", error.message);
            return NextResponse.redirect(new URL("/user/login?error=auth", requestUrl.origin));
        }

        if (data.session) {
            // Make an API call to ensure profile is created
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL;
            if (apiBaseUrl) {
                try {
                    // This will trigger ensureProfileForUser on the API side
                    await fetch(`${apiBaseUrl}/api/me`, {
                        headers: {
                            Authorization: `Bearer ${data.session.access_token}`,
                        },
                    });
                } catch (e) {
                    // Silently fail - profile will be created on next API call
                    console.warn("Failed to pre-create profile:", e);
                }
            }

            // Set auth cookies for the session
            const cookieStore = await cookies();
            const maxAge = data.session.expires_in || 3600;

            cookieStore.set("sb-access-token", data.session.access_token, {
                path: "/",
                maxAge,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
            });

            if (data.session.refresh_token) {
                cookieStore.set("sb-refresh-token", data.session.refresh_token, {
                    path: "/",
                    maxAge: 60 * 60 * 24 * 30, // 30 days
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "lax",
                });
            }
        }
    }

    // Redirect to the next URL or homepage
    const redirectUrl = next.startsWith("/") ? next : "/";
    return NextResponse.redirect(new URL(redirectUrl, requestUrl.origin));
}
