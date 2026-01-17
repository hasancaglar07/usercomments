"use client";

import AdSense from "./AdSense";

export default function AdSquare({ className }: { className?: string }) {
    return (
        <div className={`w-full flex justify-center py-4 my-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg ${className}`}>
            <AdSense
                client="ca-pub-8614212887540857"
                slot="6519877478"
                format="auto"
                responsive="true"
                style={{ width: '100%', maxWidth: '100%' }}
            />
        </div>
    );
}
