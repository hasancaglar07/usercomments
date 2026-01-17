"use client";

import AdSense from "./AdSense";

export default function AdVertical({ className }: { className?: string }) {
    return (
        <div className={`w-full flex justify-center py-4 my-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg ${className}`}>
            {/* Using a vertical ad slot or auto responsive which adapts */}
            <AdSense
                client="ca-pub-8614212887540857"
                slot="6519877478"
                format="auto" // Auto often adapts to vertical if container is height-constrained
                responsive="true"
                style={{ display: 'block' }}
            />
        </div>
    );
}
