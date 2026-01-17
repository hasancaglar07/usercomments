"use client";

import AdSense from "./AdSense";

export default function AdMultiplex({ className }: { className?: string }) {
    return (
        <div className={`w-full py-6 my-8 ${className}`}>
            <div className="w-full text-center text-xs text-slate-400 mb-2 uppercase tracking-wider">Sponsored Links</div>
            <AdSense
                client="ca-pub-8614212887540857"
                slot="9093058167"
                format="autorelaxed"
                responsive="true"
                style={{ display: 'block' }}
            />
        </div>
    );
}
