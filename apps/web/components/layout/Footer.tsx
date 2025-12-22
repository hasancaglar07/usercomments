export default function Footer() {
  return (
    <footer
      className="bg-background-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 mt-12 py-10"
      dangerouslySetInnerHTML={{
        __html: `
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div class="grid grid-cols-1 md:grid-cols-4 gap-8">
<div class="col-span-1">
<a class="flex items-center gap-2 mb-4" href="/">
<span class="material-symbols-outlined text-primary text-2xl">thumb_up</span>
<h2 class="text-xl font-bold text-text-main dark:text-white">iRecommend</h2>
</a>
<p class="text-sm text-text-muted mb-4">
                        The most trusted review platform. We help you make the best decisions with real user experiences.
                    </p>
<div class="flex gap-4">
<a class="text-gray-400 hover:text-primary transition-colors" href="https://facebook.com" rel="noreferrer" target="_blank"><span class="sr-only">Facebook</span>FB</a>
<a class="text-gray-400 hover:text-primary transition-colors" href="https://twitter.com" rel="noreferrer" target="_blank"><span class="sr-only">Twitter</span>TW</a>
<a class="text-gray-400 hover:text-primary transition-colors" href="https://instagram.com" rel="noreferrer" target="_blank"><span class="sr-only">Instagram</span>IG</a>
</div>
</div>
<div>
<h3 class="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">Explore</h3>
<ul class="space-y-2">
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/catalog">Categories</a></li>
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/catalog?sort=rating">Top Rated</a></li>
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/catalog?sort=latest">Recent Reviews</a></li>
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/catalog?sort=popular">Leaderboard</a></li>
</ul>
</div>
<div>
<h3 class="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">Community</h3>
<ul class="space-y-2">
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/terms-of-use">Rules &amp; Guidelines</a></li>
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/node/add/review">Write a Review</a></li>
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/contact">Help Center</a></li>
<li><a class="text-sm text-gray-600 dark:text-gray-400 hover:text-primary" href="/contact">Contact Us</a></li>
</ul>
</div>
<div>
<h3 class="text-sm font-bold text-text-main dark:text-white uppercase tracking-wider mb-4">Newsletter</h3>
<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Subscribe to get the best reviews directly to your inbox.</p>
<div class="flex gap-2">
<input class="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Your email" type="email"/>
<button class="bg-primary hover:bg-primary-dark text-white px-3 py-2 rounded text-sm font-bold transition-colors">Go</button>
</div>
</div>
</div>
<div class="border-t border-gray-100 dark:border-gray-800 mt-10 pt-6 text-center text-sm text-gray-500">
                © 2024 iRecommend Clone. All rights reserved.
            </div>
</div>
`,
      }}
    />
  );
}
