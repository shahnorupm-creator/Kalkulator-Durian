'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/');
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : 'Ralat tidak diketahui';
      if (errorMessage.includes('invalid-credential') || errorMessage.includes('wrong-password')) {
        setError('Email atau kata laluan tidak sah.');
      } else if (errorMessage.includes('user-not-found')) {
        setError('Akaun tidak wujud. Sila hubungi admin.');
      } else if (errorMessage.includes('too-many-requests')) {
        setError('Terlalu banyak percubaan. Sila cuba selepas beberapa minit.');
      } else {
        setError('Gagal log masuk. Sila cuba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-forest to-forest-dark flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg border border-white/20">
            <span className="text-4xl">🌱</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Durian FAMA</h1>
          <p className="text-white/50 text-sm mt-1">Sistem Anggaran Pengeluaran Durian</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-7">
          <h2 className="text-lg font-bold text-forest mb-1">Log Masuk</h2>
          <p className="text-xs text-gray-400 mb-6">Masukkan maklumat akaun anda</p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest focus:bg-white text-sm"
                placeholder="email@fama.gov.my"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 tracking-wide">
                Kata Laluan
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest focus:bg-white text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-forest text-white py-3.5 px-4 rounded-xl font-semibold shadow-lg shadow-forest/30 hover:shadow-xl hover:shadow-forest/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sedang log masuk...
                </span>
              ) : (
                'Log Masuk'
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-[11px] text-gray-400 text-center">
              Akaun disediakan oleh pentadbir sistem.
              <br />
              Hubungi admin jika anda tiada akses.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/30 text-[10px] mt-6">
          FAMA © 2026 • Peneraju Agromakanan Negara
        </p>
      </div>
    </div>
  );
}
