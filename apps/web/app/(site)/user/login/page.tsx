import LoginClient from "@/components/auth/LoginClient";

export default function Page() {
  const bodyHtml = `
<!-- Navigation Bar -->

<!-- Main Content Area -->
<main class="flex-grow flex items-center justify-center p-4 sm:p-8">
<div class="w-full max-w-[440px] flex flex-col">
<!-- Login Card -->
<div class="bg-white dark:bg-slate-800 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-700 p-6 sm:p-8">
<!-- Heading -->
<div class="mb-8 text-center">
<h1 class="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Giriş Yap</h1>
<p class="text-slate-500 dark:text-slate-400 text-sm">Topluluğumuza hoş geldiniz.</p>
</div>
<!-- Social Login Buttons -->
<div class="grid grid-cols-3 gap-3 mb-6">
<button aria-label="Login with Google" class="flex items-center justify-center h-12 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors group">
<svg class="size-5" viewbox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
</svg>
</button>
<button aria-label="Login with Facebook" class="flex items-center justify-center h-12 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors">
<svg class="size-6 text-[#1877F2]" fill="currentColor" viewbox="0 0 24 24">
<path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036c-2.148 0-2.797 1.603-2.797 2.898v1.074h5.441l-.693 3.667h-4.748v7.98c-1.332.175-2.686.175-4.017 0Z"></path>
</svg>
</button>
<button aria-label="Login with Apple" class="flex items-center justify-center h-12 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors">
<svg class="size-5 text-slate-900 dark:text-white" fill="currentColor" viewbox="0 0 24 24">
<path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.128 3.675-.552 9.093 1.541 12.096 1.037 1.486 2.231 3.13 3.78 3.07 1.541-.06 2.12-.99 3.945-.99 1.832 0 2.373.99 3.974.96 1.64-.03 2.668-1.554 3.711-3.044 1.137-1.636 1.606-3.237 1.632-3.32-.03-.027-3.161-1.217-3.195-4.816-.037-3.012 2.457-4.464 2.572-4.545-1.41-2.071-3.606-2.296-4.379-2.327-1.928-.093-3.528 1.04-4.66 1.04v-.098ZM14.976 2.9c.844-1.011 1.4-2.42 1.246-3.804-1.214.053-2.697.809-3.568 1.835-.78.913-1.464 2.385-1.275 3.784 1.353.106 2.735-.782 3.597-1.815Z"></path>
</svg>
</button>
</div>
<div class="relative flex py-2 items-center mb-6">
<div class="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
<span class="flex-shrink-0 mx-4 text-slate-400 text-xs uppercase font-semibold tracking-wider">veya e-posta ile</span>
<div class="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
</div>
<form class="space-y-5" data-auth-form>
<!-- Username/Email -->
<label class="block">
<span class="text-slate-900 dark:text-slate-200 text-sm font-medium mb-1.5 block">Kullanıcı Adı veya E-posta</span>
<div class="relative">
<input class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg h-12 px-4 pl-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="ad@ornek.com" type="text" data-auth-email/>
<div class="absolute left-0 top-0 h-full w-11 flex items-center justify-center text-slate-400 pointer-events-none">
<span class="material-symbols-outlined text-[20px]">mail</span>
</div>
</div>
</label>
<!-- Password -->
<label class="block">
<div class="flex justify-between items-center mb-1.5">
<span class="text-slate-900 dark:text-slate-200 text-sm font-medium">Şifre</span>
</div>
<div class="relative">
<input class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg h-12 px-4 pl-11 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none" placeholder="********" type="password" data-auth-password/>
<div class="absolute left-0 top-0 h-full w-11 flex items-center justify-center text-slate-400 pointer-events-none">
<span class="material-symbols-outlined text-[20px]">lock</span>
</div>
<button class="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" type="button">
<span class="material-symbols-outlined text-[20px]">visibility</span>
</button>
</div>
</label>
<div class="flex items-center justify-between">
<!-- CAPTCHA -->
<label class="flex items-center gap-3 cursor-pointer group">
<div class="relative flex items-center">
<input class="peer h-5 w-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-primary focus:ring-offset-0 focus:ring-primary/20 transition-all cursor-pointer" type="checkbox"/>
</div>
<span class="text-slate-600 dark:text-slate-300 text-sm font-normal group-hover:text-slate-800 dark:group-hover:text-white transition-colors">Ben robot değilim</span>
</label>
<!-- Forgot Password Link -->
<a class="text-sm font-medium text-primary hover:text-blue-600 dark:hover:text-blue-400 transition-colors" href="/forgot-password">Şifremi unuttum</a>
</div>
<!-- Submit Button -->
<button class="w-full h-12 bg-primary hover:bg-blue-600 text-white font-bold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2" type="submit">
<span>Giriş Yap</span>
<span class="material-symbols-outlined text-[20px]">arrow_forward</span>
</button>
</form>
<!-- Register Footer -->
<div class="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 text-center">
<p class="text-sm text-slate-500 dark:text-slate-400">
                        Henüz hesabınız yok mu? 
                        <a class="font-bold text-primary hover:text-blue-600 dark:hover:text-blue-400 ml-1 transition-colors" href="/user/login" data-auth-signup>Kayıt Ol</a>
</p>
</div>
</div>
<!-- Security Badge / Trust -->
<div class="mt-6 flex justify-center gap-6 text-slate-400 grayscale opacity-60">
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[16px]">verified_user</span>
<span class="text-xs font-medium">Güvenli Giriş</span>
</div>
<div class="flex items-center gap-1.5">
<span class="material-symbols-outlined text-[16px]">lock</span>
<span class="text-xs font-medium">256-bit SSL</span>
</div>
</div>
</div>
</main>

`;

  return (
    <div
      className="flex flex-col min-h-screen font-display bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-50 antialiased overflow-x-hidden"
      data-page="login-page"
    >
      <LoginClient />
      <div dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </div>
  );
}
