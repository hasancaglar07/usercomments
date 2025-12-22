export default function Page() {
  const bodyHtml = `
<div class="flex flex-col min-h-screen">

<!-- Main Layout -->
<main class="flex-grow w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
<!-- Breadcrumbs -->
<nav aria-label="Breadcrumb" class="flex mb-8 text-sm">
<ol class="inline-flex items-center space-x-2">
<li class="inline-flex items-center">
<a class="text-slate-500 hover:text-primary dark:text-slate-400" href="/">Home</a>
</li>
<li class="text-slate-400">/</li>
<li class="inline-flex items-center">
<a class="text-slate-500 hover:text-primary dark:text-slate-400" href="/terms-of-use">Legal</a>
</li>
<li class="text-slate-400">/</li>
<li class="inline-flex items-center">
<span class="text-slate-900 font-medium dark:text-slate-100">Privacy Policy</span>
</li>
</ol>
</nav>
<div class="flex flex-col lg:flex-row gap-10">
<!-- Sidebar Navigation (Sticky) -->
<aside class="w-full lg:w-64 flex-shrink-0">
<div class="sticky top-24 lg:max-h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar">
<div class="bg-white dark:bg-[#1a2632] rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
<h3 class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 px-2">
                                On this page
                            </h3>
<nav class="flex flex-col space-y-1">
<a class="block px-2 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-md" href="#introduction">
                                    Introduction
                                </a>
<a class="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors" href="#data-collection">
                                    Data Collection
                                </a>
<a class="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors" href="#cookies">
                                    Cookies &amp; Tracking
                                </a>
<a class="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors" href="#data-usage">
                                    How We Use Data
                                </a>
<a class="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors" href="#third-party">
                                    Third-Party Sharing
                                </a>
<a class="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors" href="#user-rights">
                                    Your Rights
                                </a>
<a class="block px-2 py-1.5 text-sm font-medium text-slate-600 hover:text-primary hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 rounded-md transition-colors" href="#contact">
                                    Contact Us
                                </a>
</nav>
</div>
<!-- CTA Box -->
<div class="mt-6 p-5 bg-gradient-to-br from-primary to-[#4BA3FF] rounded-xl text-white shadow-lg">
<span class="material-symbols-outlined text-3xl mb-2">shield_person</span>
<p class="text-sm font-medium mb-3 opacity-90">Have concerns about your data?</p>
<a class="inline-block w-full text-center py-2 px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-lg text-sm font-bold transition-colors" href="/contact">
                                Contact DPO
                            </a>
</div>
</div>
</aside>
<!-- Content Area -->
<article class="flex-1 min-w-0">
<div class="bg-white dark:bg-[#1a2632] rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 md:p-12">
<!-- Page Header -->
<div class="border-b border-slate-100 dark:border-slate-700 pb-8 mb-10">
<h1 class="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">
                                Privacy Policy
                            </h1>
<div class="flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
<span class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">calendar_today</span>
                                    Last Updated: October 24, 2023
                                </span>
<span class="hidden sm:inline text-slate-300">|</span>
<span class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[18px]">schedule</span>
                                    10 min read
                                </span>
</div>
</div>
<!-- Text Content -->
<div class="prose prose-slate dark:prose-invert max-w-none space-y-12">
<section class="scroll-mt-28" id="introduction">
<p class="text-lg leading-8 text-slate-600 dark:text-slate-300">
                                    Welcome to iRecommend. We value your trust and are committed to protecting your personal information. This Privacy Policy outlines how we collect, use, disclose, and safeguard your data when you visit our website or use our services. By accessing or using iRecommend, you agree to the terms of this Privacy Policy.
                                </p>
</section>
<section class="scroll-mt-28" id="data-collection">
<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
<span class="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
<span class="material-symbols-outlined">dataset</span>
</span>
                                    1. Data Collection
                                </h2>
<p class="text-slate-600 dark:text-slate-300 mb-4">
                                    We collect information that you provide directly to us, such as when you create an account, write a review, or contact our support team. This may include:
                                </p>
<ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-primary">
<li><strong>Personal Identification:</strong> Name, email address, and profile picture.</li>
<li><strong>Content:</strong> Reviews, ratings, photos, and comments you post.</li>
<li><strong>Communications:</strong> Records of your correspondence with us.</li>
</ul>
</section>
<section class="scroll-mt-28" id="cookies">
<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
<span class="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
<span class="material-symbols-outlined">cookie</span>
</span>
                                    2. Cookies &amp; Tracking Technologies
                                </h2>
<p class="text-slate-600 dark:text-slate-300 mb-4">
                                    We use cookies and similar tracking technologies to track the activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. However, if you do not accept cookies, you may not be able to use some portions of our Service.
                                </p>
<div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-primary p-4 rounded-r-lg my-6">
<p class="text-sm text-blue-800 dark:text-blue-200">
<strong>Note:</strong> We use both session cookies (which expire once you close your web browser) and persistent cookies (which stay on your device for a set period of time or until you delete them).
                                    </p>
</div>
</section>
<section class="scroll-mt-28" id="data-usage">
<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
<span class="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
<span class="material-symbols-outlined">analytics</span>
</span>
                                    3. How We Use Your Data
                                </h2>
<p class="text-slate-600 dark:text-slate-300 mb-4">
                                    The information we collect is used to provide, maintain, and improve our services. Specifically, we use your data to:
                                </p>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
<div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
<h4 class="font-semibold text-slate-900 dark:text-white mb-2">Service Delivery</h4>
<p class="text-sm text-slate-600 dark:text-slate-400">To create and manage your account and publish your reviews.</p>
</div>
<div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
<h4 class="font-semibold text-slate-900 dark:text-white mb-2">Personalization</h4>
<p class="text-sm text-slate-600 dark:text-slate-400">To recommend products and services based on your interests.</p>
</div>
<div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
<h4 class="font-semibold text-slate-900 dark:text-white mb-2">Communication</h4>
<p class="text-sm text-slate-600 dark:text-slate-400">To send you updates, security alerts, and administrative messages.</p>
</div>
<div class="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
<h4 class="font-semibold text-slate-900 dark:text-white mb-2">Security</h4>
<p class="text-sm text-slate-600 dark:text-slate-400">To monitor and prevent unauthorized access or fraudulent activity.</p>
</div>
</div>
</section>
<section class="scroll-mt-28" id="third-party">
<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
<span class="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
<span class="material-symbols-outlined">share</span>
</span>
                                    4. Third-Party Sharing
                                </h2>
<p class="text-slate-600 dark:text-slate-300">
                                    We do not sell your personal data. However, we may share information with third-party vendors, service providers, contractors, or agents who perform services for us or on our behalf and require access to such information to do that work.
                                </p>
</section>
<section class="scroll-mt-28" id="user-rights">
<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-3">
<span class="flex items-center justify-center size-8 rounded-lg bg-primary/10 text-primary">
<span class="material-symbols-outlined">gavel</span>
</span>
                                    5. Your Rights
                                </h2>
<p class="text-slate-600 dark:text-slate-300 mb-4">
                                    Depending on your location, you may have specific rights regarding your personal data:
                                </p>
<ul class="list-disc pl-5 space-y-2 text-slate-600 dark:text-slate-300 marker:text-primary mb-6">
<li><strong>Right to Access:</strong> You can request copies of your personal data.</li>
<li><strong>Right to Rectification:</strong> You can request that we correct any information you believe is inaccurate.</li>
<li><strong>Right to Erasure:</strong> You can request that we erase your personal data, under certain conditions.</li>
</ul>
<p class="text-slate-600 dark:text-slate-300">
                                    To exercise these rights, please contact us at our provided support channels.
                                </p>
</section>
<section class="scroll-mt-28 border-t border-slate-100 dark:border-slate-700 pt-8" id="contact">
<h2 class="text-2xl font-bold text-slate-900 dark:text-white mb-6">Contact Us</h2>
<div class="bg-slate-50 dark:bg-slate-800 rounded-xl p-6 md:p-8 flex flex-col md:flex-row gap-8 items-start">
<div class="flex-1">
<h4 class="text-lg font-bold text-slate-900 dark:text-white mb-2">General Inquiries</h4>
<p class="text-slate-600 dark:text-slate-400 text-sm mb-4">For questions about this policy or our privacy practices.</p>
<a class="inline-flex items-center gap-2 text-primary hover:text-blue-600 font-semibold transition-colors" href="mailto:privacy@irecommend.ru">
<span class="material-symbols-outlined text-lg">mail</span>
                                            privacy@irecommend.ru
                                        </a>
</div>
<div class="hidden md:block w-px h-24 bg-slate-200 dark:bg-slate-700"></div>
<div class="flex-1">
<h4 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Mailing Address</h4>
<p class="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                                            iRecommend Legal Dept.<br/>
                                            123 Innovation Drive, Suite 400<br/>
                                            Tech City, TC 94000
                                        </p>
</div>
</div>
</section>
</div>
</div>
</article>
</div>
</main>

</div>
`;

  return (
    <div className="bg-background-light dark:bg-background-dark font-display text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden" data-page="privacy-policy" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
  );
}
