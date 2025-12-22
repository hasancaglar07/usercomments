export default function Page() {
  const bodyHtml = `
<div class="flex flex-col min-h-screen">
<!-- Top Navigation -->

<!-- Main Content Area -->
<main class="flex-grow w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
<!-- Breadcrumbs -->
<nav aria-label="Breadcrumb" class="flex mb-8">
<ol class="flex items-center space-x-2">
<li>
<a class="text-slate-500 hover:text-primary transition-colors text-sm font-medium" href="/">Home</a>
</li>
<li>
<span class="text-slate-400 text-sm">/</span>
</li>
<li>
<a class="text-slate-500 hover:text-primary transition-colors text-sm font-medium" href="/terms-of-use">Legal</a>
</li>
<li>
<span class="text-slate-400 text-sm">/</span>
</li>
<li>
<span aria-current="page" class="text-slate-900 dark:text-white text-sm font-semibold">Terms of Use</span>
</li>
</ol>
</nav>
<div class="flex flex-col lg:flex-row gap-8 xl:gap-12">
<!-- Sidebar Navigation -->
<aside class="w-full lg:w-64 flex-shrink-0">
<div class="sticky top-24 bg-white dark:bg-[#1a2634] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
<div class="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
<h3 class="text-slate-900 dark:text-white font-bold text-sm uppercase tracking-wider">Legal Information</h3>
</div>
<nav class="flex flex-col p-2 space-y-1">
<a class="flex items-center gap-3 px-3 py-2.5 bg-primary/10 text-primary rounded-lg font-medium transition-colors" href="/terms-of-use">
<span class="material-symbols-outlined text-[20px]">gavel</span>
<span class="text-sm">Terms of Use</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors" href="/privacy-policy">
<span class="material-symbols-outlined text-[20px]">lock</span>
<span class="text-sm">Privacy Policy</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors" href="/terms-of-use">
<span class="material-symbols-outlined text-[20px]">description</span>
<span class="text-sm">Content Guidelines</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors" href="/privacy-policy">
<span class="material-symbols-outlined text-[20px]">cookie</span>
<span class="text-sm">Cookie Policy</span>
</a>
<a class="flex items-center gap-3 px-3 py-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white rounded-lg font-medium transition-colors" href="/terms-of-use">
<span class="material-symbols-outlined text-[20px]">copyright</span>
<span class="text-sm">DMCA Notice</span>
</a>
</nav>
<!-- Mini Contact Card in Sidebar -->
<div class="p-4 mt-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
<p class="text-xs text-slate-500 mb-2">Need help?</p>
<a class="text-sm font-semibold text-primary hover:underline flex items-center gap-1" href="/contact">
                                Contact Support 
                                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
</a>
</div>
</div>
</aside>
<!-- Document Content -->
<div class="flex-1 bg-white dark:bg-[#1a2634] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-10 lg:p-12">
<!-- Header of Document -->
<div class="mb-10 border-b border-slate-100 dark:border-slate-700 pb-8">
<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
<h1 class="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">Terms of Use</h1>
<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold uppercase tracking-wide border border-green-100 dark:border-green-800">
<span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                Active
                            </div>
</div>
<p class="text-lg text-slate-500 dark:text-slate-400 leading-relaxed">
                            Please read these terms carefully before using our platform. By accessing or using iRecommend, you agree to be bound by these terms.
                        </p>
<div class="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-400">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">calendar_month</span>
<span>Last updated: <span class="text-slate-700 dark:text-slate-300 font-medium">October 24, 2023</span></span>
</div>
<div class="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">schedule</span>
<span>Reading time: ~8 min</span>
</div>
<div class="hidden sm:block w-1 h-1 rounded-full bg-slate-300"></div>
<button class="flex items-center gap-1 text-primary hover:text-primary-dark transition-colors font-medium">
<span class="material-symbols-outlined text-[18px]">print</span>
<span>Print Version</span>
</button>
</div>
</div>
<!-- Search within document -->
<div class="relative mb-8">
<input class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all" placeholder="Search within document..." type="text"/>
<span class="material-symbols-outlined absolute left-3 top-3.5 text-slate-400">search</span>
</div>
<!-- Document Body Text -->
<article class="prose prose-slate dark:prose-invert max-w-none text-slate-600 dark:text-slate-300 leading-relaxed">
<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
<span class="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">1</span>
                            Introduction
                        </h2>
<p class="mb-4">
                            Welcome to iRecommend. These Terms of Use govern your use of our website located at iRecommend.ru (the "Service") operated by iRecommend Inc. ("us", "we", or "our").
                        </p>
<p class="mb-6">
                            By accessing or using the Service, you agree to be bound by these Terms. If you disagree with any part of the terms, then you may not access the Service. This agreement applies to all visitors, users, and others who access the Service.
                        </p>
<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
<span class="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">2</span>
                            Accounts
                        </h2>
<p class="mb-4">
                            When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service.
                        </p>
<ul class="list-disc pl-6 space-y-2 mb-6 marker:text-primary">
<li>You are responsible for safeguarding the password that you use to access the Service.</li>
<li>You agree not to disclose your password to any third party.</li>
<li>You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.</li>
</ul>
<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
<span class="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">3</span>
                            Content Guidelines
                        </h2>
<p class="mb-4">
                            Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material ("Content"). You are responsible for the Content that you post to the Service, including its legality, reliability, and appropriateness.
                        </p>
<div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary p-4 rounded-r-lg my-6">
<p class="text-sm text-slate-700 dark:text-slate-300 m-0">
<strong>Important Note:</strong> We reserve the right to remove any content that we determine to be offensive, harmful, or in violation of our <a class="text-primary hover:underline font-medium" href="/terms-of-use">Community Guidelines</a>.
                            </p>
</div>
<p class="mb-6">
                            By posting Content to the Service, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the Service. You retain any and all of your rights to any Content you submit, post or display on or through the Service and you are responsible for protecting those rights.
                        </p>
<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
<span class="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">4</span>
                            Intellectual Property
                        </h2>
<p class="mb-6">
                            The Service and its original content (excluding Content provided by users), features and functionality are and will remain the exclusive property of iRecommend Inc. and its licensors. The Service is protected by copyright, trademark, and other laws of both the United States and foreign countries. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of iRecommend Inc.
                        </p>
<h2 class="text-xl font-bold text-slate-900 dark:text-white mb-4 mt-8 flex items-center gap-2">
<span class="flex items-center justify-center size-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-sm font-bold">5</span>
                            Termination
                        </h2>
<p class="mb-6">
                            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease. If you wish to terminate your account, you may simply discontinue using the Service.
                        </p>
<hr class="my-10 border-slate-200 dark:border-slate-700"/>
<h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Contact Us</h3>
<p class="text-slate-600 dark:text-slate-400 mb-4">If you have any questions about these Terms, please contact us:</p>
<div class="flex flex-col sm:flex-row gap-4">
<a class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors" href="mailto:legal@irecommend.ru">
<span class="material-symbols-outlined text-[20px]">mail</span>
                                legal@irecommend.ru
                            </a>
<a class="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors" href="/contact">
<span class="material-symbols-outlined text-[20px]">support_agent</span>
                                Visit Support Center
                            </a>
</div>
</article>
</div>
</div>
</main>

<!-- Back to Top Button -->
<button class="fixed bottom-8 right-8 p-3 rounded-full bg-primary text-white shadow-lg hover:bg-primary-dark transition-all duration-300 z-50 group">
<span class="material-symbols-outlined group-hover:-translate-y-1 transition-transform duration-300">arrow_upward</span>
</button>
</div>
`;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-white antialiased" data-page="terms-of-use" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
  );
}
