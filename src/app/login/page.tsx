'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Locale, LOCALE_SHORT } from '@/lib/i18n';

function LanguageSwitcher({
  locale,
  setLocale,
  label,
}: {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  label: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex items-center rounded-full border border-white/90 bg-white/95 p-1 shadow-[0_5px_16px_rgba(6,59,42,.18)] backdrop-blur-md"
    >
      {(['bm', 'en'] as Locale[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          aria-pressed={locale === lang}
          className={`rounded-full px-4 py-1.5 text-xs font-extrabold transition-all duration-200 ${
            locale === lang
              ? 'bg-gradient-to-r from-[#15942B] to-[#075A3A] text-white shadow-sm'
              : 'text-[#063B2A] hover:bg-[#ECF5EA]'
          }`}
        >
          {LOCALE_SHORT[lang]}
        </button>
      ))}
    </div>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10M12 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      {crossed && <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path d="M14 5h5v14h-5M3 12h11m-3.5-3.5L14 12l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();

  // Authentication dan route asal dikekalkan. Hanya rupa halaman diubah.
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('invalid-credential') || errorMessage.includes('wrong-password')) {
        setError(t('login.errorInvalid'));
      } else if (errorMessage.includes('user-not-found')) {
        setError(t('login.errorNotFound'));
      } else if (errorMessage.includes('too-many-requests')) {
        setError(t('login.errorTooMany'));
      } else if (errorMessage.includes('network-request-failed')) {
        setError(t('login.errorNetwork'));
      } else {
        setError(t('login.errorGeneral'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-[#EAF4ED] md:h-screen md:overflow-hidden">
      {/* Desktop: SATU kanvas penuh daripada design rujukan. Tiada gabungan dua gambar. */}
      <img
        src="/assets/login/login-reference-full.webp"
        alt=""
        className="absolute inset-0 hidden h-full w-full object-fill md:block"
        loading="eager"
        decoding="async"
      />

      {/* Mobile: orchard bersih kerana hero besar disembunyikan. */}
      <img
        src="/assets/login/orchard-backdrop.webp"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center md:hidden"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-white/20 md:hidden" aria-hidden="true" />

      {/* Language switch sebenar menutup switch visual dalam artwork */}
      <div className="absolute right-4 top-4 z-40 md:right-[3.6vw] md:top-[3vh]">
        <LanguageSwitcher locale={locale} setLocale={setLocale} label={t('login.selectLanguage')} />
      </div>

      <div className="relative z-20 flex min-h-screen items-center justify-center px-4 pb-6 pt-16 md:absolute md:left-[5%] md:top-[7%] md:h-[89%] md:min-h-0 md:w-[34.5%] md:px-0 md:py-0">
        {/* Panel HTML sebenar menutup panel/form statik pada background dengan tepat. */}
        <section className="login-glass-panel login-panel-enter flex w-full max-w-[500px] flex-col justify-center rounded-[34px] px-5 py-6 sm:px-7 md:h-full md:max-h-none md:min-h-0 md:max-w-none md:px-[clamp(22px,2.3vw,38px)] md:py-[clamp(18px,2.5vh,30px)]">
          <div className="mx-auto w-full max-w-[390px]">
            {/* Logo FAMA dan RMP sebenar daripada design pengguna */}
            <img
              src="/assets/branding/fama-rmp-clean.webp"
              width={289}
              height={118}
              alt="Logo FAMA dan Risikan & Pemodenan Pasaran RMP"
              className="mx-auto h-[70px] w-auto object-contain sm:h-[78px] md:h-[clamp(64px,9vh,86px)]"
              loading="eager"
              decoding="async"
            />

            <header className="mt-3 text-center md:mt-[1.5vh]">
              <p className="text-sm font-bold leading-tight text-[#075A3A] sm:text-base">{t('login.welcomeIntro')}</p>
              <h1 className="mt-0.5 text-[22px] font-extrabold leading-[1.12] text-[#063B2A] sm:text-2xl md:text-[clamp(21px,1.75vw,29px)]">
                {t('app.title')}
              </h1>
              <span className="mt-2.5 inline-block h-1 w-16 rounded-full bg-gradient-to-r from-[#D9AD32] to-[#8CC63F]" aria-hidden="true" />
            </header>

            {/* Kad borang login sebenar */}
            <div className="mt-4 rounded-[26px] border border-white/70 bg-white/80 p-5 shadow-[0_12px_34px_rgba(6,59,42,.13)] backdrop-blur-lg md:mt-[2vh] md:p-[clamp(18px,2.3vh,24px)]">
              <div className="mb-4 flex items-center gap-3 md:mb-[1.7vh]">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8CC63F] to-[#15942B] text-white shadow-md" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M6 19c.5-4 2.5-6 6-6s5.5 2 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </span>
                <div>
                  <h2 className="text-lg font-extrabold leading-tight text-[#063B2A]">{t('login.title')}</h2>
                  <p className="mt-0.5 text-[11px] text-[#60776C]">{t('login.subtitle')}</p>
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-600">
                  <span aria-hidden="true">⚠</span><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3.5 md:space-y-[1.5vh]" noValidate>
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-xs font-extrabold text-[#17372C]">{t('login.email')}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60776C]" aria-hidden="true"><MailIcon /></span>
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      disabled={loading}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={t('login.emailPlaceholder')}
                      className="h-[52px] w-full rounded-xl border border-[#CFDCE8] bg-[#EEF4FF]/75 py-3 pl-11 pr-4 text-sm text-[#17372C] shadow-sm outline-none transition placeholder:text-gray-400 focus:border-[#087536] focus:ring-2 focus:ring-[#8CC63F]/25 disabled:cursor-not-allowed disabled:opacity-60 md:h-[clamp(46px,6.3vh,54px)]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-xs font-extrabold text-[#17372C]">{t('login.password')}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60776C]" aria-hidden="true"><LockIcon /></span>
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      disabled={loading}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="h-[52px] w-full rounded-xl border border-[#CFDCE8] bg-[#EEF4FF]/75 py-3 pl-11 pr-12 text-sm text-[#17372C] shadow-sm outline-none transition focus:border-[#087536] focus:ring-2 focus:ring-[#8CC63F]/25 disabled:cursor-not-allowed disabled:opacity-60 md:h-[clamp(46px,6.3vh,54px)]"
                    />
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      aria-pressed={showPassword}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#60776C] outline-none transition hover:bg-[#EAF4E9] hover:text-[#075A3A] focus:ring-2 focus:ring-[#8CC63F]/30 disabled:opacity-50"
                    >
                      <EyeIcon crossed={showPassword} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#15942B] via-[#087536] to-[#05572D] px-4 font-extrabold text-white shadow-[0_8px_20px_rgba(7,90,58,.24)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_26px_rgba(7,90,58,.3)] focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/40 focus:ring-offset-2 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0 md:h-[clamp(48px,6.5vh,56px)]"
                >
                  {loading ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" aria-hidden="true" />{t('login.loggingIn')}</>
                  ) : (
                    <><LoginIcon />{t('login.submit').toUpperCase()}</>
                  )}
                </button>
              </form>

              <div className="mt-4 flex items-start gap-2 border-t border-[#DDE5DF] pt-3.5 md:mt-[1.8vh] md:pt-[1.5vh]">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#8CC63F] text-[11px] font-extrabold text-[#087536]" aria-hidden="true">i</span>
                <p className="text-[10px] leading-relaxed text-[#60776C]">{t('login.footer')}<br />{t('login.footerContact')}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
