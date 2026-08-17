'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Navbar() {
  const pathname = usePathname();
  const { profile, isOnline, hasPageAccess, isAnyAdmin } = useAuth();
  const { t } = useLanguage();

  const allNavItems = [
    { href: '/', label: t('nav.kebun'), icon: '🌱', pageKey: 'profil_kebun' },
    { href: '/kalkulator', label: t('nav.kalkulator'), icon: '📊', pageKey: 'kalkulator' },
    { href: '/dashboard-hq', label: t('nav.dashboard'), icon: '🗺️', pageKey: 'dashboard_hq' },
    { href: '/profil', label: t('nav.profil'), icon: '👤', pageKey: 'profil' },
    ...(isAnyAdmin ? [{ href: '/admin', label: t('nav.admin'), icon: '⚙️', pageKey: 'admin' }] : []),
  ];

  const navItems = allNavItems.filter(item => hasPageAccess(item.pageKey));

  return (
    <>
      <header className="bg-gradient-forest text-white px-4 py-3 flex items-center justify-between shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">🌱</span>
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight">{t('app.title')}</h1>
            <p className="text-[9px] opacity-60">
              {profile?.nama || 'Pegawai'} &bull; {profile?.negeri || profile?.daerah || '-'}
              {profile?.role && ` \u2022 ${ROLE_LABELS[profile.role] || profile.role}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[9px]">{isOnline ? t('nav.online') : t('nav.offline')}</span>
        </div>
      </header>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 safe-bottom shadow-[0_-2px_15px_rgba(0,0,0,0.05)]">
        <div className={`max-w-2xl mx-auto grid grid-cols-${Math.min(navItems.length, 5)}`}>
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-2.5 transition-all ${
                  isActive ? 'text-forest border-t-2 border-forest -mt-[2px]' : 'text-gray-400'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className={`text-[9px] leading-tight text-center ${isActive ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
