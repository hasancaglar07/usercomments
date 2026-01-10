import Link from "next/link";
import { getLatestComments } from "@/src/lib/api";
import { SupportedLanguage } from "@/src/lib/i18n";
import { t } from "@/src/lib/copy";
import { getOptimizedImageUrl } from "@/src/lib/image-optimization";

export default async function RecentComments({ lang }: { lang: SupportedLanguage }) {
    let comments = [];

    try {
        const result = await Promise.race([
            getLatestComments(5, lang),
            new Promise<{ items: never[] }>((_, reject) =>
                setTimeout(() => reject(new Error('Comments API timeout')), 15000)
            )
        ]);
        comments = result.items || [];
    } catch (error) {
        console.error("Failed to load recent comments:", error);
    }

    if (!comments || comments.length === 0) return null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-[20px]">forum</span>
                    {t(lang, "homepage.recentComments")}
                </h2>
            </div>
            <div className="flex flex-col gap-3">
                {comments.map((comment) => {
                    const avatarUrl = getOptimizedImageUrl(comment.author.profilePicUrl, 50);

                    return (
                        <div key={comment.id} className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-2">
                            <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center text-slate-400 shrink-0">
                                        {avatarUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={avatarUrl}
                                                alt={comment.author.username}
                                                className="w-full h-full object-cover"
                                                decoding="async"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <span className="material-symbols-outlined text-[14px]">person</span>
                                        )}
                                    </div>
                                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                                        {comment.author.displayName || comment.author.username}
                                    </span>
                                </div>
                                <span className="text-[10px] shrink-0">
                                    {new Date(comment.createdAt).toLocaleDateString(lang, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed italic border-l-2 border-slate-100 dark:border-slate-800 pl-2">
                                &quot;{comment.text}&quot;
                            </p>
                            {comment.review && (
                                <div className="mt-1 pt-2 border-t border-slate-50 dark:border-slate-800/50">
                                    <Link href={`/${lang}/content/${comment.review.slug}`} className="text-primary hover:underline font-medium text-xs line-clamp-1 block">
                                        ↳ {comment.review.title}
                                    </Link>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
