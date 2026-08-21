'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

export default function AdminPegawaiPage() {
  const { profile, isAnyAdmin } = useAuth();
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
            onChange={(e) => setForm({ ...form, nama: e.target.value })}
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
            onChange={(e) => setForm({ ...form, daerah: e.target.value })}
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
                  <h3 className="font-semibold text-forest">{p.nama}</h3>
                  <p className="text-xs text-gray-500">{p.email}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {p.noPerkerja} &middot; {p.daerah}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(p.uid, p.nama)}
                  className="text-red-400 hover:text-red-600 text-sm"
                >
                  🗑️
                </button>
              </div>
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
    </div>
  );
}
