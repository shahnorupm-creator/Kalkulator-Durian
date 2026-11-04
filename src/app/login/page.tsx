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
      className="inline-flex items-center rounded-full border border-white/80 bg-white/90 p-1 shadow-lg backdrop-blur-md"
    >
      {(['bm', 'en'] as Locale[]).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => setLocale(lang)}
          aria-pressed={locale === lang}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all duration-200 ${
            locale === lang
              ? 'bg-[#087536] text-white shadow-sm'
              : 'text-[#17372C]/65 hover:bg-[#EAF4E9] hover:text-[#063B2A]'
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
      <path d="M4 6.5h16v11H4z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" strokeWidth="1.7" />
      <path d="M12 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M3 12s3.2-5 9-5 9 5 9 5-3.2 5-9 5-9-5-9-5Z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      {hidden && <path d="m4 4 16 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M14 5h5v14h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12h11m-3.5-3.5L14 12l-3.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MiniDashboard() {
  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#F6F9F5] text-[#17372C]">
      <aside className="w-[23%] flex-shrink-0 bg-[#075A3A] p-[3%] text-white">
        <div className="mb-[14%] flex items-center gap-1.5 font-bold">
          <span className="text-[clamp(7px,.7vw,11px)]">🌱 FAMA</span>
        </div>
        {['Dashboard', 'Modul Kebun', 'Kalkulator', 'Laporan', 'Pemantauan'].map((item, index) => (
          <div
            key={item}
            className={`mb-[7%] rounded px-[8%] py-[5%] text-[clamp(4px,.48vw,8px)] ${
              index === 1 ? 'bg-[#8CC63F] font-bold' : 'text-white/80'
            }`}
          >
            {item}
          </div>
        ))}
      </aside>
      <main className="min-w-0 flex-1 p-[3%]">
        <div className="mb-[3%] flex items-center justify-between">
          <p className="text-[clamp(6px,.7vw,11px)] font-extrabold">Modul Kebun</p>
          <span className="rounded-full bg-[#E8F3E4] px-2 py-0.5 text-[clamp(4px,.42vw,7px)] text-[#075A3A]">FAMA</span>
        </div>
        <div className="grid grid-cols-4 gap-[2%]">
          {[
            ['🌳', 'Jumlah Kebun', '13'],
            ['📐', 'Keluasan', '88 ha'],
            ['🍈', 'Anggaran Hasil', '374.94 MT'],
            ['◆', 'Kategori Varieti', '6'],
          ].map(([icon, label, value]) => (
            <div key={label} className="rounded-md border border-[#DDE5DF] bg-white p-[5%] text-center shadow-sm">
              <div className="text-[clamp(7px,.8vw,13px)]">{icon}</div>
              <p className="mt-0.5 truncate text-[clamp(3px,.38vw,6px)] text-gray-500">{label}</p>
              <p className="text-[clamp(6px,.62vw,10px)] font-extrabold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-[3%] grid h-[51%] grid-cols-[1.4fr_.9fr] gap-[2%]">
          <div className="relative overflow-hidden rounded-md border border-[#DDE5DF] bg-[#DCECDD]">
            <img src="/MAPS%20MALAYSIA.jpg" alt="" className="h-full w-full object-cover opacity-80" />
            <span className="absolute left-[32%] top-[35%] h-2 w-2 rounded-full bg-[#8CC63F] ring-2 ring-white" />
            <span className="absolute left-[48%] top-[48%] h-2 w-2 rounded-full bg-[#D9AD32] ring-2 ring-white" />
          </div>
          <div className="flex items-end justify-around rounded-md border border-[#DDE5DF] bg-white px-[7%] pb-[8%] pt-[12%]">
            {[35, 52, 46, 68, 82, 94].map((height, index) => (
              <span
                key={index}
                className="w-[9%] rounded-t-sm bg-gradient-to-t from-[#075A3A] to-[#8CC63F]"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function DeviceShowcase() {
  return (
    <div className="relative mx-auto w-[92%] max-w-[760px]">
      {/* Laptop */}
      <div className="relative mx-auto w-[78%]">
        <div className="aspect-[16/9] overflow-hidden rounded-[12px] border-[7px] border-[#26332D] bg-white shadow-[0_22px_45px_rgba(6,59,42,.28)]">
          <div className="flex h-[11%] items-center justify-center bg-gradient-to-r from-[#075A3A] to-[#8CC63F] text-[clamp(5px,.62vw,10px)] font-bold text-white">
            Sistem Kalkulator Durian FAMA
          </div>
          <div className="h-[89%]">
            <MiniDashboard />
          </div>
        </div>
        <div className="mx-auto h-4 w-[108%] -translate-x-[4%] rounded-b-[55%] bg-gradient-to-b from-[#EEF2EF] to-[#9FA8A3] shadow-lg" />
      </div>

      {/* Smartphone */}
      <div className="absolute -bottom-[2%] right-[2%] w-[18%] min-w-[74px] rotate-[2deg] rounded-[16px] border-[5px] border-[#1B2420] bg-[#F7F9F6] p-1.5 shadow-[0_18px_35px_rgba(0,0,0,.3)]">
        <div className="mx-auto mb-1 h-1 w-8 rounded-full bg-[#27342E]" />
        <div className="overflow-hidden rounded-[9px] bg-gradient-to-b from-[#EAF7E5] to-white">
          <div className="bg-[#075A3A] px-1 py-2 text-center text-[clamp(5px,.55vw,8px)] font-bold text-white">Kalkulator Durian</div>
          <div className="p-2">
            {['Modul Kebun', 'Kalkulator Hasil', 'Laporan'].map((item, index) => (
              <div key={item} className="mb-1.5 flex items-center gap-1 rounded-md border border-[#DDE5DF] bg-white px-1.5 py-1.5 shadow-sm">
                <span className="flex h-4 w-4 items-center justify-center rounded bg-[#075A3A] text-[7px] text-white">{index + 1}</span>
                <span className="truncate text-[clamp(5px,.5vw,8px)] font-semibold text-[#17372C]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
    <main className="login-page relative min-h-screen overflow-x-hidden bg-[#EAF3EB] md:h-screen md:overflow-hidden">
      {/* Orchard background: imej sekadar latar visual, semua UI di atas ialah HTML sebenar */}
      <img
        src="/pemantauan-durian.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        loading="eager"
        decoding="async"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-[#F4FAF4]/70 to-[#EAF7ED]/30" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#DDF3F5]/35 via-transparent to-[#063B2A]/15" aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 h-[20%] bg-gradient-to-r from-[#063B2A] via-[#075A3A] to-[#0B7146]"
        style={{ clipPath: 'polygon(0 48%, 28% 73%, 58% 58%, 100% 82%, 100% 100%, 0 100%)' }}
        aria-hidden="true"
      />

      {/* BM / EN */}
      <div className="absolute right-4 top-4 z-40 md:right-[3.5vw] md:top-[3vh]">
        <LanguageSwitcher locale={locale} setLocale={setLocale} label={t('login.selectLanguage')} />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col md:h-screen md:flex-row md:items-stretch">
        {/* LEFT: panel fungsi sebenar */}
        <section className="login-panel-enter relative mx-4 mb-6 mt-16 flex w-auto flex-col justify-center rounded-[30px] border border-white/80 bg-white/90 px-5 py-6 shadow-[0_24px_70px_rgba(6,59,42,.18)] backdrop-blur-xl sm:mx-auto sm:w-[430px] sm:px-7 md:my-[4vh] md:ml-[3.2vw] md:mr-0 md:mt-[4vh] md:h-[92vh] md:w-[39%] md:max-w-[445px] md:flex-shrink-0 md:px-[clamp(20px,2.1vw,34px)] md:py-[clamp(18px,2.5vh,28px)]">
          <div className="mx-auto w-full max-w-[350px]">
            {/* Logo rasmi sebenar */}
            <div className="flex justify-center">
              <img
                src="/assets/branding/fama-rmp-transparent.webp"
                width={445}
                height={162}
                alt="Logo FAMA dan Risikan & Pemodenan Pasaran RMP"
                className="h-[64px] w-auto object-contain sm:h-[72px] md:h-[clamp(58px,9vh,76px)]"
                loading="eager"
                decoding="async"
              />
            </div>

            <header className="mt-3 text-center md:mt-[1.5vh]">
              <p className="text-[13px] font-bold leading-tight text-[#075A3A] sm:text-sm">{t('login.welcomeIntro')}</p>
              <h1 className="mt-0.5 text-xl font-extrabold leading-tight text-[#063B2A] sm:text-[22px]">
                {t('app.title')}
              </h1>
              <span className="mt-2 inline-block h-1 w-14 rounded-full bg-gradient-to-r from-[#D9AD32] to-[#8CC63F]" aria-hidden="true" />
            </header>

            <div className="mt-4 rounded-[24px] border border-white bg-white/88 p-5 shadow-[0_12px_35px_rgba(6,59,42,.12)] md:mt-[2vh] md:p-[clamp(16px,2.2vh,22px)]">
              <div className="mb-4 flex items-center gap-2.5 md:mb-[1.8vh]">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#8CC63F] to-[#087536] text-white shadow-md" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M6 19c.5-4 2.5-6 6-6s5.5 2 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>
                </span>
                <div>
                  <h2 className="text-base font-bold text-[#063B2A]">{t('login.title')}</h2>
                  <p className="text-[10px] text-gray-500">{t('login.subtitle')}</p>
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="assertive" className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  <span aria-hidden="true">⚠</span><span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 md:space-y-[1.35vh]" noValidate>
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-[11px] font-bold text-[#17372C]">{t('login.email')}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60776C]" aria-hidden="true"><MailIcon /></span>
                    <input
                      id="login-email" name="email" type="email" autoComplete="username" required disabled={loading}
                      value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('login.emailPlaceholder')}
                      className="h-[50px] w-full rounded-xl border border-[#DDE5DF] bg-white/95 py-3 pl-11 pr-4 text-sm text-[#17372C] shadow-sm outline-none transition focus:border-[#087536] focus:ring-2 focus:ring-[#8CC63F]/25 disabled:cursor-not-allowed disabled:opacity-60 md:h-[clamp(44px,6.4vh,52px)]"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="mb-1.5 block text-[11px] font-bold text-[#17372C]">{t('login.password')}</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#60776C]" aria-hidden="true"><LockIcon /></span>
                    <input
                      id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required disabled={loading}
                      value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                      className="h-[50px] w-full rounded-xl border border-[#DDE5DF] bg-white/95 py-3 pl-11 pr-12 text-sm text-[#17372C] shadow-sm outline-none transition focus:border-[#087536] focus:ring-2 focus:ring-[#8CC63F]/25 disabled:cursor-not-allowed disabled:opacity-60 md:h-[clamp(44px,6.4vh,52px)]"
                    />
                    <button
                      type="button" disabled={loading} onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')} aria-pressed={showPassword}
                      className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[#60776C] outline-none transition hover:bg-[#EAF4E9] hover:text-[#075A3A] focus:ring-2 focus:ring-[#8CC63F]/30 disabled:opacity-50"
                    >
                      <EyeIcon hidden={showPassword} />
                    </button>
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="group flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#15942B] via-[#087536] to-[#05572D] px-4 font-bold text-white shadow-[0_8px_20px_rgba(7,90,58,.22)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_25px_rgba(7,90,58,.28)] focus:outline-none focus:ring-2 focus:ring-[#8CC63F]/40 focus:ring-offset-2 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 motion-reduce:hover:translate-y-0 md:h-[clamp(46px,6.4vh,52px)]"
                >
                  {loading ? (
                    <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white motion-reduce:animate-none" aria-hidden="true" />{t('login.loggingIn')}</>
                  ) : (
                    <><LoginIcon />{t('login.submit').toUpperCase()}</>
                  )}
                </button>
              </form>

              <div className="mt-4 flex items-start gap-2 border-t border-[#DDE5DF] pt-3 md:mt-[1.8vh] md:pt-[1.4vh]">
                <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-[#8CC63F] text-[11px] font-bold text-[#087536]" aria-hidden="true">i</span>
                <p className="text-[10px] leading-relaxed text-gray-500">{t('login.footer')}<br />{t('login.footerContact')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT: branding dan mockup visual */}
        <section className="login-hero-enter relative hidden min-w-0 flex-1 flex-col md:flex">
          <div className="flex h-[42%] items-center justify-center px-[4%] pt-[3vh]">
            <img
              src="/assets/branding/kd-mark-transparent.webp"
              width={970} height={575} alt="Logo Kalkulator Durian"
              className="w-[clamp(150px,16vw,255px)] flex-shrink-0 object-contain drop-shadow-[0_12px_18px_rgba(6,59,42,.22)]"
              loading="eager" decoding="async"
            />
            <div className="ml-[2.2vw] border-l-2 border-[#D9AD32] pl-[2.2vw]">
              <p className="text-[clamp(28px,3.6vw,58px)] font-black italic leading-[.95] tracking-tight text-[#075A3A] drop-shadow-sm">KALKULATOR</p>
              <p className="text-[clamp(42px,5.7vw,88px)] font-black italic leading-[.92] tracking-tight text-[#D9AD32] drop-shadow-[0_3px_0_rgba(109,74,0,.18)]">DURIAN</p>
              <div className="mt-[1.5vh] rounded-full bg-gradient-to-r from-[#075A3A] to-[#15942B] px-[2vw] py-[.8vh] text-center text-[clamp(9px,1vw,15px)] font-extrabold leading-tight text-white shadow-md">
                SISTEM PEMANTAUAN &amp;<br />ANGGARAN HASIL DURIAN
              </div>
            </div>
          </div>

          <div className="relative flex h-[58%] items-end justify-center px-[3%] pb-[5vh]">
            <DeviceShowcase />
            <div className="absolute bottom-3 right-3 h-[clamp(90px,14vw,190px)] w-[clamp(90px,14vw,190px)] overflow-hidden rounded-full border-4 border-white/80 shadow-2xl [mask-image:radial-gradient(circle,black_58%,transparent_74%)]" aria-hidden="true">
              <img src="/kebun.jpg" alt="" className="h-full w-full object-cover" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
