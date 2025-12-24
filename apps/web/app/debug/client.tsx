"use client";

import { useEffect, useState } from "react";

export default function ClientDebug({ apiUrl }: { apiUrl: string }) {
    const [state, setState] = useState<{ status: string; data: any; error: any }>({
        status: "Loading...",
        data: null,
        error: null,
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const start = Date.now();
                const res = await fetch(apiUrl);
                const data = await res.json();
                setState({
                    status: `${res.status} (${Date.now() - start}ms)`,
                    data,
                    error: null,
                });
            } catch (err: any) {
                setState({
                    status: "Error",
                    data: null,
                    error: err.message,
                });
            }
        };

        fetchData();
    }, [apiUrl]);

    return (
        <div className="mt-8 border border-blue-300 bg-blue-50 p-4 rounded text-black">
            <h2 className="font-bold text-lg mb-2">2. Client-Side Test (Your Browser)</h2>
            <div className="mb-2">
                <strong>Status:</strong> {state.status}
            </div>
            {state.error && (
                <div className="mb-2 text-red-600">
                    <strong>Error:</strong> {state.error}
                </div>
            )}
            {state.data && (
                <details>
                    <summary className="cursor-pointer font-semibold">View Data (First Item)</summary>
                    <pre className="mt-2 bg-white p-2 text-xs overflow-auto border rounded max-h-40">
                        {JSON.stringify(state.data.items?.[0] || state.data, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}
