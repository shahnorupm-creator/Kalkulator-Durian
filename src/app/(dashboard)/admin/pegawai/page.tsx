'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Pegawai {
  uid: string;
  nama: string;
  email: string;
  noPerkerja: string;
  daerah: string;
  role: string;
}

// Auto-format: Capitalize Each Word (kekalkan akronim)
const ACRONYMS = ['FAMA', 'IOI', 'HQ', 'GPS', 'MARDI', 'MPOB', 'RISDA', 'FELDA', 'FELCRA', 'JPM', 'KPM'];
const capitalizeWords = (str: string) =>
  str.replace(/\b[\p{L}']+/gu, (word) => {
    const upper = word.toUpperCase();
    if (ACRONYMS.includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });

export default function AdminPegawaiPage() {
  const { profile, isAnyAdmin, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [pegawaiList, setPegawaiList] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showPegawaiPass, setShowPegawaiPass] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    nama: '',
    noPerkerja: '',
    daerah: '',
  });

  // Edit email/kata laluan (superadmin sahaja)
  const [editTarget, setEditTarget] = useState<Pegawai | null>(null);
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);

  const openEdit = (p: Pegawai) => {
    setEditTarget(p);
    setEditForm({ email: p.email, password: '' });
    setShowEditPass(false);
  };

  // Bina header dengan ID token pemanggil untuk pengesahan di sisi server.
  // Guna getIdToken(true) untuk paksa refresh — token cache boleh tamat tempoh (~1 jam)
  // dan menyebabkan ralat "Token pengesahan tidak sah atau telah tamat tempoh".
  const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await auth.currentUser?.getIdToken(true);
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    const emailChanged = editForm.email.trim() && editForm.email.trim() !== editTarget.email;
    const passwordChanged = editForm.password.trim().length > 0;

    if (!emailChanged && !passwordChanged) {
      toast.error('Tiada perubahan untuk disimpan.');
      return;
    }

    setEditLoading(true);
    try {
      const res = await fetch('/api/admin/update-user', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({
          uid: editTarget.uid,
          email: emailChanged ? editForm.email.trim() : undefined,
          password: passwordChanged ? editForm.password.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengemas kini pengguna');
      }

      toast.success('Maklumat pegawai berjaya dikemas kini!');
      setEditTarget(null);
      setEditForm({ email: '', password: '' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Ralat tidak diketahui';
      toast.error(msg);
    } finally {
      setEditLoading(false);
    }
  };

  // Redirect if not admin
  useEffect(() => {
    if (profile && !isAnyAdmin) {
      router.push('/');
    }
  }, [profile, isAnyAdmin, router]);

  // Fetch all users
  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'pegawai'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Pegawai[] = snapshot.docs.map((doc) => ({
        uid: doc.id,
        ...doc.data(),
      })) as Pegawai[];
      setPegawaiList(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mencipta pegawai');
      }

      toast.success('Pegawai berjaya dicipta!');
      setShowForm(false);
      setForm({ email: '', password: '', nama: '', noPerkerja: '', daerah: '' });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Ralat tidak diketahui';
      toast.error(msg);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (uid: string, nama: string) => {
    if (!confirm(`Padam pegawai "${nama}"? Tindakan ini tidak boleh dibuat asal.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ uid }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Gagal memadam pegawai');
      }

      toast.success('Pegawai berjaya dipadam.');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Ralat tidak diketahui';
      toast.error(msg);
    }
  };

  if (!isAnyAdmin) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-forest">Urus Pegawai</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-semibold"
        >
          {showForm ? 'Tutup' : '+ Tambah'}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-gold space-y-3"
        >
          <h3 className="font-bold text-forest text-sm">Pegawai Baru</h3>
          <input
            type="email"
            placeholder="Email *"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
            required
          />
          <div className="relative">
            <input
              type={showPegawaiPass ? 'text' : 'password'}
              placeholder="Kata Laluan * (min 6 aksara)"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm pr-9"
              required
              minLength={6}
            />
            <button type="button" onClick={() => setShowPegawaiPass(!showPegawaiPass)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">
              {showPegawaiPass ? '🙈' : '👁'}
            </button>
          </div>
          <input
            type="text"
            placeholder="Nama Penuh *"
            value={form.nama}
            onChange={(e) => setForm({ ...form, nama: capitalizeWords(e.target.value) })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
            required
          />
          <input
            type="text"
            placeholder="No. Pekerja *"
            value={form.noPerkerja}
            onChange={(e) => setForm({ ...form, noPerkerja: e.target.value })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
            required
          />
          <input
            type="text"
            placeholder="Daerah *"
            value={form.daerah}
            onChange={(e) => setForm({ ...form, daerah: capitalizeWords(e.target.value) })}
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
            required
          />
          <button
            type="submit"
            disabled={formLoading}
            className="w-full bg-gold text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
          >
            {formLoading ? 'Mencipta...' : 'Cipta Pegawai'}
          </button>
        </form>
      )}

      {/* Pegawai List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : pegawaiList.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl">
          <span className="text-3xl block mb-2">👤</span>
          <p className="text-gray-500 text-sm">Belum ada pegawai didaftarkan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pegawaiList.map((p) => (
            <div
              key={p.uid}
              className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-forest"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-forest">{capitalizeWords(p.nama || '')}</h3>
                  <p className="text-xs text-gray-500">{p.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.noPerkerja} &middot; {p.daerah}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isSuperAdmin && (
                    <button
                      onClick={() => openEdit(p)}
                      className="text-forest hover:text-moss text-sm"
                      title="Kemas kini email & kata laluan"
                    >
                      ✏️
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(p.uid, p.nama)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    🗑️
                  </button>
                </div>
              </div>
              {isSuperAdmin && (
                <button
                  onClick={() => openEdit(p)}
                  className="mt-2 text-[10px] font-semibold text-forest underline underline-offset-2"
                >
                  Kemas Kini Email / Kata Laluan
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Jumlah: {pegawaiList.length} pegawai berdaftar
      </p>

      {/* Link to Admin Dashboard */}
      <button
        onClick={() => router.push('/admin/dashboard')}
        className="w-full border border-forest text-forest py-3 rounded-lg text-sm font-semibold hover:bg-forest/5"
      >
        📊 Lihat Dashboard Data
      </button>

      {/* Modal: Kemas Kini Email & Kata Laluan (Superadmin sahaja) */}
      {editTarget && isSuperAdmin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !editLoading && setEditTarget(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleUpdate}
            className="bg-white rounded-2xl p-5 shadow-xl w-full max-w-sm space-y-3 border-t-4 border-forest"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-forest text-sm">Kemas Kini Akaun</h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="bg-forest/5 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-forest">{editTarget.nama}</p>
              <p className="text-[10px] text-gray-500">{editTarget.noPerkerja} &middot; {editTarget.daerah}</p>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                placeholder="email@fama.gov.my"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-gray-500 mb-1 block">
                Kata Laluan Baru
              </label>
              <div className="relative">
                <input
                  type={showEditPass ? 'text' : 'password'}
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm pr-9"
                  placeholder="Biar kosong jika tidak mahu tukar"
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowEditPass(!showEditPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  {showEditPass ? '🙈' : '👁'}
                </button>
              </div>
              <p className="text-[9px] text-gray-400 mt-1">
                Minimum 6 aksara. Biar kosong untuk kekalkan kata laluan sedia ada.
              </p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                disabled={editLoading}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={editLoading}
                className="flex-1 bg-forest text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {editLoading ? 'Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
