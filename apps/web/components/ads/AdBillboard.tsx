"use client";

import AdSense from "./AdSense";

export default function AdBillboard({ className }: { className?: string }) {
    return (
        <div className={`w-full flex justify-center py-4 bg-slate-50 dark:bg-slate-800/50 ${className}`}>
            <div className="container mx-auto max-w-7xl px-4 flex justify-center">
                <AdSense
                    client="ca-pub-8614212887540857"
                    slot="6519877478"
                    format="auto"
                    responsive="true"
                    style={{ display: 'block', width: '100%', maxHeight: '280px', overflow: 'hidden' }}
                />
            </div>
        </div>
    );
}
