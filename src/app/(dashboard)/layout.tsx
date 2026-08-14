'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function DesktopSidebar() {
  const pathname = usePathname();
  const { profile, isSuperAdmin, isAnyAdmin, hasPageAccess, signOut } = useAuth();

  const allNavItems = [
    { href: '/', label: 'Profil & Kebun', icon: '🌱', desc: 'Daftar & urus kebun', pageKey: 'profil_kebun' },
    { href: '/kalkulator', label: 'Usia & Fasa', icon: '📊', desc: 'Kira anggaran hasil', pageKey: 'kalkulator' },
    { href: '/dashboard-hq', label: 'Dashboard HQ', icon: '🗺️', desc: 'Analisis keseluruhan', pageKey: 'dashboard_hq' },
    { href: '/laporan', label: 'Laporan', icon: '📋', desc: 'Jana laporan infografik', pageKey: 'laporan' },
    { href: '/profil', label: 'Profil Saya', icon: '👤', desc: 'Kemaskini profil & password', pageKey: 'profil' },
    ...(isAnyAdmin ? [{ href: '/admin', label: 'Admin Panel', icon: '⚙️', desc: 'Urus pengguna & role', pageKey: 'admin' }] : []),
    ...(isSuperAdmin ? [{ href: '/admin/settings', label: 'Tetapan Akses', icon: '🔒', desc: 'Kawal akses halaman', pageKey: 'admin' }] : []),
  ];

  const navItems = allNavItems.filter(item => hasPageAccess(item.pageKey));

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed top-0 left-0 h-screen z-40">
      {/* Logo */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-forest rounded-xl flex items-center justify-center shadow-md">
            <span className="text-xl">🌱</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-forest">Kalkulator Durian</h1>
            <p className="text-[9px] text-gray-400">FAMA Malaysia</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                isActive
                  ? 'bg-forest/10 text-forest'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-forest'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <div>
                <p className={`text-sm ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</p>
                <p className="text-[9px] text-gray-400">{item.desc}</p>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-forest/10 rounded-full flex items-center justify-center">
            <span className="text-sm">👤</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-forest truncate">{profile?.nama || '-'}</p>
            <p className="text-[9px] text-gray-400 truncate">{profile?.negeri || profile?.daerah || '-'} &bull; {ROLE_LABELS[profile?.role || 'pegawai']}</p>
          </div>
        </div>
        <button onClick={signOut}
          className="w-full text-xs text-gray-400 hover:text-red-500 py-2 rounded-lg hover:bg-red-50 transition-all">
          Log Keluar
        </button>
      </div>
    </aside>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-forest rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse shadow-lg">
            <span className="text-3xl">🌱</span>
          </div>
          <p className="text-forest font-semibold text-sm">Memuatkan sistem...</p>
          <p className="text-gray-400 text-xs mt-1">Sila tunggu sebentar</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Desktop sidebar - hidden on mobile */}
      <DesktopSidebar />

      {/* Mobile top header + bottom nav - hidden on desktop */}
      <div className="lg:hidden">
        <Navbar />
      </div>

      {/* Main content area */}
      <main className="lg:ml-64 pb-24 lg:pb-8">
        <div className="max-w-4xl mx-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
