'use client';

import { useState, useEffect } from 'react';
import { useAuth, ALL_ROLES, ROLE_LABELS, ROLE_COLORS, APP_PAGES, DEFAULT_PAGE_ACCESS } from '@/contexts/AuthContext';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import type { UserRole } from '@/contexts/AuthContext';

export default function AdminSettingsPage() {
  const { profile, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [pageAccess, setPageAccess] = useState<Record<string, UserRole[]>>(DEFAULT_PAGE_ACCESS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile && !isSuperAdmin) {
      router.push('/');
    }
  }, [profile, isSuperAdmin, router]);

  // Fetch current settings
  useEffect(() => {
    const fetch = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'pageAccess'));
        if (snap.exists()) {
          setPageAccess(snap.data() as Record<string, UserRole[]>);
        }
      } catch (e) {
        console.warn('Using defaults');
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const toggleAccess = (pageKey: string, role: UserRole) => {
    setPageAccess(prev => {
      const current = prev[pageKey] || [];
      if (current.includes(role)) {
        return { ...prev, [pageKey]: current.filter(r => r !== role) };
      } else {
        return { ...prev, [pageKey]: [...current, role] };
      }
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'pageAccess'), pageAccess);
      toast.success('Tetapan akses berjaya disimpan!');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan tetapan.');
    }
    setSaving(false);
  };

  const handleReset = () => {
    if (confirm('Reset semua ke tetapan asal?')) {
      setPageAccess(DEFAULT_PAGE_ACCESS);
      toast.success('Reset ke default.');
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/admin')} className="text-forest text-xl">←</button>
        <div>
          <h2 className="text-lg font-bold text-forest">Tetapan Akses Halaman</h2>
          <p className="text-xs text-gray-500">Super Admin sahaja boleh ubah settings ini</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-xs font-bold text-gray-600 mb-2">Senarai Role:</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map(role => (
            <span key={role} className={`text-[9px] px-2 py-1 rounded-full font-bold ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          ))}
        </div>
      </div>

      {/* Page Access Matrix */}
      {loading ? (
        <div className="bg-white rounded-xl p-8 text-center animate-pulse">
          <p className="text-gray-400 text-sm">Memuatkan tetapan...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {APP_PAGES.map(page => (
            <div key={page.key} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-forest">{page.label}</h4>
                  <p className="text-[9px] text-gray-400">{page.path}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {ALL_ROLES.map(role => {
                  const hasAccess = (pageAccess[page.key] || []).includes(role);
                  // Super admin always has access (can't be toggled off)
                  const isLocked = role === 'superadmin';
                  return (
                    <button
                      key={role}
                      onClick={() => !isLocked && toggleAccess(page.key, role)}
                      disabled={isLocked}
                      className={`text-[9px] px-2.5 py-1.5 rounded-lg font-medium transition-all border ${
                        hasAccess
                          ? `${ROLE_COLORS[role]} border-current`
                          : 'bg-gray-50 text-gray-300 border-gray-200'
                      } ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}`}
                    >
                      {hasAccess ? '✓ ' : ''}{ROLE_LABELS[role].split(' ').slice(1).join(' ')}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex-1 bg-gradient-forest text-white py-3 rounded-xl font-semibold shadow-lg active:scale-[0.98] disabled:opacity-50">
          {saving ? 'Menyimpan...' : '💾 Simpan Tetapan'}
        </button>
        <button onClick={handleReset}
          className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
          Reset
        </button>
      </div>

      {/* Explanation */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
        <p className="font-bold mb-1">📌 Cara guna:</p>
        <ul className="list-disc list-inside space-y-0.5 text-[10px]">
          <li>Click badge role untuk ON/OFF akses ke halaman tersebut</li>
          <li>Role yang aktif (berwarna) = boleh akses halaman tu</li>
          <li>Role yang gray = tiada akses</li>
          <li>Super Admin sentiasa ada akses ke semua (tak boleh dipadamkan)</li>
          <li>Perubahan berkuatkuasa serta-merta selepas simpan</li>
        </ul>
      </div>
    </div>
  );
}
