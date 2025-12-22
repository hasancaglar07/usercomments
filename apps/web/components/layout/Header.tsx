export default function Header() {
  return (
    <header
      className="bg-background-light dark:bg-surface-dark border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50"
      dangerouslySetInnerHTML={{
        __html: `
<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div class="flex items-center justify-between h-16 gap-4">
<!-- Logo -->
<a class="flex items-center gap-2 flex-shrink-0 cursor-pointer" href="/">
<span class="material-symbols-outlined text-primary text-3xl">thumb_up</span>
<h1 class="text-2xl font-bold tracking-tight text-primary">iRecommend</h1>
</a>
<!-- Search Bar -->
<div class="hidden md:flex flex-1 max-w-2xl mx-4">
<form class="relative w-full group" action="/search" method="get">
<div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
<span class="material-symbols-outlined text-gray-400">search</span>
</div>
<input class="block w-full pl-10 pr-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg leading-5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent sm:text-sm transition duration-150 ease-in-out" name="q" placeholder="Find reviews for products, services, hotels..." type="text"/>
</form>
</div>
<!-- Action Buttons -->
<div class="flex items-center gap-3">
<a class="hidden sm:flex items-center justify-center h-10 px-4 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-lg transition-colors shadow-sm" href="/node/add/review">
<span class="material-symbols-outlined text-[18px] mr-1">add</span>
<span class="truncate">Add Review</span>
</a>
<a class="flex items-center justify-center h-10 px-4 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-text-main dark:text-white text-sm font-bold rounded-lg transition-colors" href="/user/login" data-auth-link>
<span class="truncate" data-auth-label>Sign In</span>
</a>
</div>
</div>
<!-- Secondary Navigation -->
<nav class="hidden md:flex gap-8 py-3 overflow-x-auto hide-scrollbar border-t border-gray-100 dark:border-gray-800">
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Beauty</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Tech</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Travel</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Health</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Auto</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Books</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Kids</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Finance</a>
<a class="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-primary whitespace-nowrap" href="/catalog">Movies</a>
</nav>
</div>
`,
      }}
    />
  );
}
