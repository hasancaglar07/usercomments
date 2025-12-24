import { t } from "@/src/lib/copy";
import { formatCompactNumber } from "@/src/lib/review-utils";

type RatingHistogramProps = {
    ratingAvg: number;
    ratingCount: number;
    lang: string;
};

export default function RatingHistogram({
    ratingAvg,
    ratingCount,
    lang,
}: RatingHistogramProps) {
    // Synthesize a distribution that matches the average
    // This is a visual approximation since we don't have the raw buckets from DB yet
    const dist = calculateApproximateDistribution(ratingAvg, ratingCount);
    const maxCount = Math.max(...Object.values(dist));

    return (
        <div className="flex flex-col gap-2 min-w-[200px]">
            {[5, 4, 3, 2, 1].map((star) => {
                const count = dist[star as keyof typeof dist];
                const percent = ratingCount > 0 ? (count / ratingCount) * 100 : 0;
                const width = maxCount > 0 ? (count / maxCount) * 100 : 0;

                return (
                    <div key={star} className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 w-8 text-slate-600 dark:text-slate-400 font-medium">
                            <span>{star}</span>
                            <span className="material-symbols-outlined text-[14px]">star</span>
                        </div>
                        <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${width}%` }}
                            />
                        </div>
                        <div className="w-10 text-right text-xs text-slate-500 dark:text-slate-500 tabular-nums">
                            {percent > 0 ? `${Math.round(percent)}%` : "0%"}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Generates a plausible 1-5 star distribution that roughly matches a given average.
 */
function calculateApproximateDistribution(avg: number, total: number) {
    if (total <= 0) return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // Heuristic: Skew probability weights based on avg
    // avg 5 -> weights [0,0,0,0,1]
    // avg 1 -> weights [1,0,0,0,0]
    // avg 3 -> weights centered

    // Power factor to sharpen the peak around the average
    const power = 3;

    const weights: Record<number, number> = {};
    let weightSum = 0;

    for (let i = 1; i <= 5; i++) {
        // Distance from the average
        const diff = Math.abs(i - avg);
        // Inverse distance weight, closer is higher
        // Add small epsilon to avoid div by zero if exactly on integer
        const w = 1 / (Math.pow(diff + 0.5, power));
        weights[i] = w;
        weightSum += w;
    }

    // Distribute total counts according to weights
    const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let allocated = 0;

    for (let i = 1; i <= 5; i++) {
        const rawCount = (weights[i] / weightSum) * total;
        const rounded = Math.round(rawCount);
        distribution[i] = rounded;
        allocated += rounded;
    }

    // Adjust mainly the one closest to average to match exact total
    const diff = total - allocated;
    const closest = Math.round(avg);
    // safeguard if avg is weird, clamp to 1-5
    const target = Math.max(1, Math.min(5, closest));
    distribution[target] += diff;

    return distribution;
}
