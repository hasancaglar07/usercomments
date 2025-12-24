import ClientDebug from "./client";

export const runtime = "edge";

export default async function DebugPage() {
    const API_URL = "https://irecommend-api.usercomments.workers.dev/api/reviews/popular?limit=1";

    let serverResult = { status: "Pending", data: null, error: null, time: 0 };

    try {
        const start = Date.now();
        const res = await fetch(API_URL, {
            cache: "no-store",
            headers: {
                "User-Agent": "Cloudflare-Pages-Debugger/1.0"
            }
        });

        // Try to parse text first to show raw response if JSON fails
        const text = await res.text();
        serverResult.time = Date.now() - start;
        serverResult.status = res.status.toString();

        try {
            serverResult.data = JSON.parse(text);
        } catch (e) {
            serverResult.data = `Failed to parse JSON. Raw body: ${text.slice(0, 500)}`;
        }

    } catch (e: any) {
        serverResult.status = "EXCEPTION";
        serverResult.error = e.message + (e.cause ? ` (Cause: ${e.cause})` : "");
    }

    return (
        <div className="p-8 font-sans max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">System Connection Debugger</h1>

            <div className="mb-4 text-sm text-gray-600">
                <strong>API Target:</strong> {API_URL}
            </div>

            <div className="border border-gray-300 bg-gray-50 p-4 rounded text-black">
                <h2 className="font-bold text-lg mb-2">1. Server-Side Test (Cloudflare Pages)</h2>
                <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                        <strong>Status:</strong> <span className={serverResult.status === "200" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{serverResult.status}</span>
                    </div>
                    <div>
                        <strong>Latency:</strong> {serverResult.time}ms
                    </div>
                </div>

                {serverResult.error && (
                    <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded">
                        <strong>CRITICAL ERROR:</strong> {serverResult.error}
                    </div>
                )}

                <div className="mt-2">
                    <strong className="block mb-1">Response Preview:</strong>
                    <pre className="bg-white p-3 text-xs overflow-auto border rounded max-h-60 font-mono">
                        {serverResult.data ? JSON.stringify(serverResult.data, null, 2) : "No data received"}
                    </pre>
                </div>
            </div>

            <ClientDebug apiUrl={API_URL} />

            <div className="mt-8 text-xs text-gray-400">
                timestamp: {new Date().toISOString()}
            </div>
        </div>
    );
}
