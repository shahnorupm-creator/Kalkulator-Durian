'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Locale, LOCALE_SHORT } from '@/lib/i18n';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { locale, setLocale, t } = useLanguage();
  const router = useRouter();

  // Fungsi authentication KEKAL SAMA seperti sebelum ini — hanya UI diubah.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // elak double-submit
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
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
    <div className="relative min-h-screen md:h-screen md:overflow-hidden flex flex-col md:flex-row bg-forest-dark">
      {/* Latar atmospheric orchard untuk mobile/tablet kecil sahaja (disembunyikan pada md+) */}
      <div
        className="absolute inset-0 md:hidden bg-cover bg-no-repeat"
        style={{ backgroundImage: "url('/background%20durian.png')", backgroundPosition: 'center 25%' }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 md:hidden bg-gradient-to-b from-forest-dark/85 via-forest-dark/80 to-forest-dark/95"
        aria-hidden="true"
      />

      {/* ============ BAHAGIAN KIRI — LOGIN (fungsi) ============ */}
      <div
        className="relative z-10 w-full md:w-[45%] lg:w-[39%] flex flex-col items-center justify-center
                   px-5 sm:px-6 md:px-8 py-8 md:py-6 md:h-full md:overflow-y-auto
                   bg-transparent md:bg-gradient-to-br md:from-forest-dark md:via-forest md:to-fama-green"
      >
        <div className="w-full max-w-sm">
          {/* Logo FAMA + RMP sebenar (dipotong terus dari asset rasmi, tidak diubah bentuk/warna) */}
          <div className="flex justify-center mb-5">
            <div className="rounded-2xl overflow-hidden shadow-lg">
              <img
                src="/assets/branding/fama-rmp-strip.webp"
                width={445}
                height={162}
                alt="Logo FAMA dan Risikan & Pemodenan Pasaran (RMP)"
                className="h-[64px] sm:h-[72px] w-auto block"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>

          {/* Welcome heading */}
          <div className="text-center mb-6">
            <p className="text-xs sm:text-sm font-semibold text-white/70 md:text-white/70">
              {t('login.welcomeIntro')}
            </p>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-snug mt-0.5">
              {t('app.title')}
            </h1>
            <span
              className="inline-block w-14 h-1 rounded-full mt-2.5"
              style={{ background: 'linear-gradient(90deg, #D9AD32, #8CC63F)' }}
              aria-hidden="true"
            />
          </div>

          {/* Login Card — glass panel putih/off-white */}
          <div className="bg-white/95 backdrop-blur-md border border-white/60 rounded-[28px] shadow-2xl p-6 sm:p-7">
            <div className="flex items-center gap-2.5 mb-1">
              <span
                className="w-8 h-8 rounded-full bg-forest/10 text-forest flex items-center justify-center text-base flex-shrink-0"
                aria-hidden="true"
              >
                👤
              </span>
              <h2 className="text-base sm:text-lg font-bold text-forest-dark">{t('login.title')}</h2>
            </div>
            <p className="text-xs text-gray-400 mb-5 ml-[42px]">{t('login.subtitle')}</p>

            {error && (
              <div
                role="alert"
                aria-live="assertive"
                className="bg-red-50 border border-red-200 text-red-600 px-3.5 py-2.5 rounded-xl mb-4 text-sm flex items-start gap-2"
              >
                <span aria-hidden="true">⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label
                  htmlFor="login-email"
                  className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide"
                >
                  {t('login.email')}
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
                    aria-hidden="true"
                  >
                    ✉️
                  </span>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="w-full min-h-[52px] pl-10 pr-4 py-3 bg-gray-50 border border-[#DDE5DF] rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-forest/25 focus:border-forest focus:bg-white
                               text-sm text-[#17372C] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    placeholder={t('login.emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              {/* Kata Laluan */}
              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide"
                >
                  {t('login.password')}
                </label>
                <div className="relative">
                  <span
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none"
                    aria-hidden="true"
                  >
                    🔒
                  </span>
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className="w-full min-h-[52px] pl-10 pr-11 py-3 bg-gray-50 border border-[#DDE5DF] rounded-xl
                               focus:outline-none focus:ring-2 focus:ring-forest/25 focus:border-forest focus:bg-white
                               text-sm text-[#17372C] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    disabled={loading}
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    aria-pressed={showPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center
                               text-gray-400 hover:text-forest text-sm rounded-lg transition-colors
                               focus:outline-none focus:ring-2 focus:ring-forest/25 disabled:opacity-60"
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[52px] bg-gradient-forest text-white py-3.5 px-4 rounded-2xl font-semibold
                           shadow-lg shadow-forest/30 hover:shadow-xl hover:-translate-y-0.5 motion-reduce:hover:translate-y-0
                           transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                           active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    {t('login.loggingIn')}
                  </>
                ) : (
                  <>
                    <span aria-hidden="true">→</span>
                    {t('login.submit')}
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 flex items-start gap-2">
              <span className="text-gray-400 text-sm mt-0.5 flex-shrink-0" aria-hidden="true">
                ℹ️
              </span>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                {t('login.footer')}
                <br />
                {t('login.footerContact')}
              </p>
            </div>
          </div>

          <p className="text-center text-white/60 text-[10px] mt-5">{t('app.copyright')}</p>
        </div>
      </div>

      {/* ============ BAHAGIAN KANAN — HERO / IDENTITI SISTEM (visual) ============ */}
      <div className="hidden md:block relative flex-1 md:h-full overflow-hidden">
        <img
          src="/assets/login/hero-visual.webp"
          width={1672}
          height={771}
          alt="Kalkulator Durian FAMA — Sistem Pemantauan & Anggaran Hasil Durian"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          decoding="async"
        />
        {/* Gradien halus di tepi kiri supaya sambungan dengan panel login kemas */}
        <div
          className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-forest-dark/70 to-transparent"
          aria-hidden="true"
        />
      </div>

      {/* ============ BM / EN — penjuru kanan atas ============ */}
      <div className="absolute top-4 right-4 z-30">
        <div
          role="group"
          aria-label={t('login.selectLanguage')}
          className="inline-flex items-center bg-white/95 backdrop-blur-sm rounded-full p-1 shadow-lg border border-white/50"
        >
          {(['bm', 'en'] as Locale[]).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLocale(lang)}
              aria-pressed={locale === lang}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                locale === lang
                  ? 'bg-forest text-white shadow-sm'
                  : 'text-forest-dark/60 hover:text-forest-dark'
              }`}
            >
              {LOCALE_SHORT[lang]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
