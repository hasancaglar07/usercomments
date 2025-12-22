export default function Page() {
  const bodyHtml = `
<!-- Top Navigation Bar -->

<!-- Main Content Area -->
<main class="flex-grow flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
<div class="w-full max-w-[480px]">
<!-- Card Container -->
<div class="bg-white dark:bg-[#1a2634] shadow-lg rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
<!-- Page Heading Section -->
<div class="p-8 pb-4">
<div class="flex flex-col gap-3 text-center">
<div class="mx-auto bg-primary/10 size-12 rounded-full flex items-center justify-center mb-2">
<span class="material-symbols-outlined text-primary text-2xl">lock_reset</span>
</div>
<h1 class="text-slate-900 dark:text-white tracking-tight text-2xl sm:text-[32px] font-bold leading-tight">Forgot your password?</h1>
<p class="text-slate-500 dark:text-slate-400 text-sm font-normal leading-relaxed">
                            Enter the email address associated with your account and we'll send you a link to reset your password.
                        </p>
</div>
</div>
<!-- Form Section -->
<form class="p-8 pt-2 flex flex-col gap-5">
<!-- Email Field -->
<div class="flex flex-col gap-2">
<label class="text-slate-900 dark:text-white text-sm font-bold leading-normal" for="email">Email Address</label>
<div class="relative">
<input class="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-3 pl-11 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors" id="email" name="email" placeholder="user@example.com" required="" type="email"/>
<span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl pointer-events-none">mail</span>
</div>
</div>
<!-- Submit Button -->
<button class="w-full cursor-pointer flex items-center justify-center rounded-lg h-12 bg-primary hover:bg-primary-dark active:bg-primary-dark/90 text-white text-base font-bold leading-normal tracking-[0.015em] transition-all shadow-md hover:shadow-lg transform active:scale-[0.99]" type="submit">
                        Send Reset Link
                    </button>
<!-- Meta / Helper Links -->
<div class="flex flex-col items-center gap-4 mt-2">
<a class="group flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary transition-colors" href="/user/login">
<span class="material-symbols-outlined text-lg group-hover:-translate-x-1 transition-transform">arrow_back</span>
                            Back to Log In
                        </a>
<p class="text-sm text-slate-500 dark:text-slate-400">
                            Don't have an account? <a class="text-primary font-bold hover:underline" href="/user/login">Sign up</a>
</p>
</div>
</form>
</div>
</div>
</main>
<!-- Simple Footer -->

`;

  return (
    <div className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white min-h-screen flex flex-col font-display" data-page="forgot-password" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
  );
}
