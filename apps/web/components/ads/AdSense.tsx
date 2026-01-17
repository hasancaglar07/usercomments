"use client";

import { useEffect, useRef } from "react";

type AdAuth = {
    client: string;
    slot: string;
    format?: string;
    responsive?: string;
};

type Props = AdAuth & {
    className?: string;
    style?: React.CSSProperties;
};

export default function AdSense({
    client,
    slot,
    format = "auto",
    responsive = "true",
    className,
    style,
}: Props) {
    const adRef = useRef<HTMLModElement>(null);

    useEffect(() => {
        try {
            if (typeof window !== "undefined") {
                const adsbygoogle = (window as any).adsbygoogle || [];
                // Only push if the ad hasn't been initialized in this slot yet (simple check)
                // However, standard adsbygoogle implementation tolerates push calls.
                // The important part is that <ins> is in the DOM.
                // React 18 strict mode might double invoke, so we wrap in try-catch

                // Check if this specific element already has the 'data-adsbygoogle-status' attribute
                // which Google adds after processing.
                if (adRef.current && !adRef.current.getAttribute("data-adsbygoogle-status")) {
                    adsbygoogle.push({});
                }
            }
        } catch (err: any) {
            console.error("AdSense error:", err);
        }
    }, []); // Run once on mount

    return (
        <div className={className} style={{ overflow: 'hidden', minHeight: '100px', ...style }}>
            <ins
                ref={adRef}
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={client}
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive}
            />
        </div>
    );
}
