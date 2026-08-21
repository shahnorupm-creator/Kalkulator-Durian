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

  const [nama, setNama] = useState(profile?.nama || '');
  const [noPerkerja, setNoPerkerja] = useState(profile?.noPerkerja || '');
  const [daerah, setDaerah] = useState(profile?.daerah || '');
  const [alamatPejabat, setAlamatPejabat] = useState(profile?.alamatPejabat || '');
  const [noTelefon, setNoTelefon] = useState(profile?.noTelefon || '');

  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const ACRONYMS = ['FAMA', 'IOI', 'HQ', 'GPS', 'MARDI', 'MPOB', 'RISDA', 'FELDA', 'FELCRA', 'JPM', 'KPM'];
  const capitalizeWords = (str: string) =>
    str.replace(/\b[\p{L}']+/gu, (word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.includes(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  const getRoleLabel = (role: string) => ROLE_LABELS[role as keyof typeof ROLE_LABELS] || role;

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        nama: nama.trim(),
        noPerkerja: noPerkerja.trim(),
        daerah: daerah.trim(),
        alamatPejabat: alamatPejabat.trim(),
        noTelefon: noTelefon.trim(),
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
    if (newPass.length < 6) { toast.error('Kata Laluan Baru Mesti Sekurang-Kurangnya 6 Aksara.'); return; }
    if (newPass !== confirmPass) { toast.error('Kata Laluan Baru Tidak Sepadan.'); return; }
    setChangingPass(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);
      toast.success(t('profil.passwordChanged'));
      setShowPasswordForm(false);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential')) {
        toast.error('Kata Laluan Semasa Tidak Betul.');
      } else {
        toast.error('Gagal Tukar Kata Laluan. Cuba Lagi.');
      }
    }
    setChangingPass(false);
  };

  const profileData = profile;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-4 overflow-hidden">
      {/* Header Card */}
      <div className="bg-gradient-forest rounded-2xl p-5 text-white relative overflow-hidden flex items-center gap-4">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center border-2 border-white/30 flex-shrink-0">
          <span className="text-2xl">👤</span>
        </div>
        <div className="relative z-10 flex-1 min-w-0">
          <h3 className="text-lg font-bold truncate">{profile?.nama || '-'}</h3>
          <p className="text-white/70 text-xs">{getRoleLabel(profile?.role || 'pegawai')}</p>
          <p className="text-white/50 text-[10px] mt-0.5">{profile?.email}</p>
        </div>
        {!editMode && (
          <button onClick={() => { setEditMode(true); setNama(profile?.nama || ''); setNoPerkerja(profile?.noPerkerja || ''); setDaerah(profile?.daerah || ''); setAlamatPejabat(profileData?.alamatPejabat || ''); setNoTelefon(profileData?.noTelefon || ''); }}
            className="text-[9px] bg-white/20 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-white/30 transition-all flex-shrink-0 relative z-20">
            ✏️ Kemaskini
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {editMode ? (
          /* Edit Form */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h4 className="text-sm font-bold text-forest">✏️ Kemas Kini Profil</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Nama Penuh</label>
                <input value={nama} onChange={(e) => setNama(capitalizeWords(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">No. Pekerja</label>
                <input value={noPerkerja} onChange={(e) => setNoPerkerja(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">Daerah</label>
                <input value={daerah} onChange={(e) => setDaerah(capitalizeWords(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">No. Telefon</label>
                <input value={noTelefon} onChange={(e) => setNoTelefon(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                  placeholder="013-7717886" />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-semibold text-gray-500">Alamat Pejabat</label>
                <input value={alamatPejabat} onChange={(e) => setAlamatPejabat(capitalizeWords(e.target.value))}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                  placeholder="Pejabat FAMA Negeri Kedah, Jalan..." />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setEditMode(false)}
                className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600">Batal</button>
              <button onClick={handleSaveProfile} disabled={saving}
                className="flex-1 bg-gradient-forest text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {saving ? 'Menyimpan...' : '✓ Simpan'}
              </button>
            </div>
          </div>
        ) : (
          /* View Mode — Two Column */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Nama Penuh</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profile?.nama || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">No. Pekerja</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profile?.noPerkerja || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Negeri</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profile?.negeri || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Daerah</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profile?.daerah || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Email</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profile?.email || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Role</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{getRoleLabel(profile?.role || '')}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">No. Telefon</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profileData?.noTelefon || '-'}</p>
              </div>
              <div>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">Alamat Pejabat</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{profileData?.alamatPejabat || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Change Password */}
        {!editMode && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mt-3">
            {showPasswordForm ? (
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-forest">🔐 Tukar Kata Laluan</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                    placeholder="Kata Laluan Semasa" />
                  <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                    placeholder="Kata Laluan Baru (Min 6)" minLength={6} />
                  <input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)}
                    className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                    placeholder="Sahkan Kata Laluan Baru" />
                </div>
                {newPass && confirmPass && newPass !== confirmPass && (
                  <p className="text-[9px] text-red-500">⚠️ Kata Laluan Tidak Sepadan</p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { setShowPasswordForm(false); setCurrentPass(''); setNewPass(''); setConfirmPass(''); }}
                    className="px-4 py-2 border border-gray-300 rounded-xl text-xs text-gray-600">Batal</button>
                  <button onClick={handleChangePassword} disabled={changingPass || !currentPass || !newPass || newPass !== confirmPass}
                    className="flex-1 bg-gradient-gold text-black py-2 rounded-xl text-xs font-bold disabled:opacity-50">
                    {changingPass ? 'Menukar...' : '🔐 Tukar'}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowPasswordForm(true)}
                className="w-full text-xs text-amber-700 font-semibold py-2.5 border border-amber-200 rounded-xl hover:bg-amber-50">
                🔐 Tukar Kata Laluan
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-[9px] text-gray-400 text-center">
        ℹ️ Negeri Dan Role Diurus Oleh Pentadbir. Hubungi Admin Untuk Perubahan.
      </p>
    </div>
  );
}
