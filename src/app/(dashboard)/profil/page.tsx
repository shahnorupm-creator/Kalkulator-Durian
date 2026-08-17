'use client';

import { useState } from 'react';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { doc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db, auth } from '@/lib/firebase';
import toast from 'react-hot-toast';

export default function ProfilPage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [nama, setNama] = useState(profile?.nama || '');
  const [noPerkerja, setNoPerkerja] = useState(profile?.noPerkerja || '');
  const [daerah, setDaerah] = useState(profile?.daerah || '');

  // Password form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  // Auto-format: Capitalize Each Word
  const capitalizeWords = (str: string) =>
    str.replace(/\b[\p{L}']+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  const getRoleLabel = (role: string) => {
    return ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nama: nama.trim(),
        noPerkerja: noPerkerja.trim(),
        daerah: daerah.trim(),
      });
      toast.success(t('profil.saved'));
      setEditMode(false);
    } catch (e) {
      console.error(e);
      toast.error(t('profil.saveFailed'));
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!user || !user.email) return;
    if (newPass.length < 6) {
      toast.error('Kata laluan baru mesti sekurang-kurangnya 6 aksara.');
      return;
    }
    if (newPass !== confirmPass) {
      toast.error('Kata laluan baru tidak sepadan.');
      return;
    }

    setChangingPass(true);
    try {
      // Re-authenticate first
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPass);

      toast.success(t('profil.passwordChanged'));
      setShowPasswordForm(false);
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        toast.error('Kata laluan semasa tidak betul.');
      } else {
        toast.error('Gagal tukar kata laluan. Cuba lagi.');
      }
    }
    setChangingPass(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-forest">{t('profil.title')}</h2>

      {/* Profile Header Card */}
      <div className="bg-gradient-forest rounded-2xl p-6 text-white text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
        <div className="relative z-10">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 border-2 border-white/30">
            <span className="text-3xl">👤</span>
          </div>
          <h3 className="text-lg font-bold">{profile?.nama || '-'}</h3>
          <p className="text-white/60 text-sm mt-0.5">{getRoleLabel(profile?.role || 'pegawai')}</p>
          <p className="text-white/40 text-xs mt-1">{profile?.email}</p>
        </div>
      </div>

      {/* Profile Details */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {editMode ? (
          <div className="p-5 space-y-3">
            <h4 className="text-sm font-bold text-forest">✏️ Kemas Kini Profil</h4>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Nama Penuh</label>
              <input value={nama} onChange={(e) => setNama(capitalizeWords(e.target.value))}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">No. Pekerja</label>
              <input value={noPerkerja} onChange={(e) => setNoPerkerja(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Daerah</label>
              <input value={daerah} onChange={(e) => setDaerah(capitalizeWords(e.target.value))}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex-1 bg-gradient-forest text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan...' : '✓ Simpan'}
              </button>
              <button onClick={() => setEditMode(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600">
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-5 py-4 flex justify-between items-center">
              <div>
                <label className="text-[10px] font-semibold text-gray-400 tracking-wider">Nama Penuh</label>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.nama || '-'}</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <label className="text-[10px] font-semibold text-gray-400 tracking-wider">No. Pekerja</label>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.noPerkerja || '-'}</p>
            </div>
            <div className="px-5 py-4">
              <label className="text-[10px] font-semibold text-gray-400 tracking-wider">Negeri</label>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.negeri || '-'}</p>
            </div>
            <div className="px-5 py-4">
              <label className="text-[10px] font-semibold text-gray-400 tracking-wider">Daerah</label>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.daerah || '-'}</p>
            </div>
            <div className="px-5 py-4">
              <label className="text-[10px] font-semibold text-gray-400 tracking-wider">Email</label>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{profile?.email || '-'}</p>
            </div>
            <div className="px-5 py-4">
              <label className="text-[10px] font-semibold text-gray-400 tracking-wider">Role</label>
              <p className="text-sm font-semibold text-gray-800 mt-0.5">{getRoleLabel(profile?.role || '')}</p>
            </div>
            <div className="px-5 py-3">
              <button onClick={() => { setEditMode(true); setNama(profile?.nama || ''); setNoPerkerja(profile?.noPerkerja || ''); setDaerah(profile?.daerah || ''); }}
                className="w-full text-sm text-forest font-semibold py-2.5 border border-forest/20 rounded-xl hover:bg-forest/5">
                ✏️ Kemas Kini Profil
              </button>
            </div>
          </>
        )}
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        {showPasswordForm ? (
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-forest">🔐 Tukar Kata Laluan</h4>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Kata Laluan Semasa</label>
              <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="Masukkan kata laluan semasa" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Kata Laluan Baru (min 6 aksara)</label>
              <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="Kata laluan baru" minLength={6} />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">Sahkan Kata Laluan Baru</label>
              <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="Ulangi kata laluan baru" />
            </div>
            {newPass && confirmPass && newPass !== confirmPass && (
              <p className="text-xs text-red-500">⚠️ Kata laluan tidak sepadan</p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={handleChangePassword} disabled={changingPass || !currentPass || !newPass || newPass !== confirmPass}
                className="flex-1 bg-gradient-gold text-black py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {changingPass ? 'Menukar...' : '🔐 Tukar Kata Laluan'}
              </button>
              <button onClick={() => { setShowPasswordForm(false); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600">
                Batal
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPasswordForm(true)}
            className="w-full text-sm text-amber-700 font-semibold py-2.5 border border-amber-200 rounded-xl hover:bg-amber-50">
            🔐 Tukar Kata Laluan
          </button>
        )}
      </div>

      {/* Info */}
      <p className="text-[10px] text-gray-400 text-center px-4">
        ℹ️ Negeri dan Role diurus oleh pentadbir. Hubungi admin untuk perubahan.
      </p>
    </div>
  );
}
