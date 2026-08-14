'use client';

import { useState, useEffect } from 'react';
import { useAuth, ALL_ROLES, ROLE_LABELS, ROLE_COLORS } from '@/contexts/AuthContext';
import type { UserRole } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, doc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SENARAI_NEGERI } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface UserRecord {
  uid: string;
  nama: string;
  email: string;
  noPerkerja: string;
  negeri: string;
  daerah: string;
  role: UserRole;
}

export default function AdminPage() {
  const { profile, isSuperAdmin, isAdminNegeri, isAnyAdmin, canCreateUser } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [filterRole, setFilterRole] = useState('Semua');
  const [form, setForm] = useState({
    email: '',
    password: '',
    nama: '',
    noPerkerja: '',
    negeri: '',
    daerah: '',
    role: 'pegawai' as UserRole,
  });

  // Determine scope
  const adminNegeri = profile?.negeri || '';
  const isNegeriScoped = isAdminNegeri && adminNegeri && adminNegeri !== 'HQ';

  useEffect(() => {
    if (profile && !isAnyAdmin) {
      router.push('/');
    }
  }, [profile, isAnyAdmin, router]);

  // Fetch users — scoped for admin negeri
  useEffect(() => {
    if (!isAnyAdmin) return;
    let q;
    if (isSuperAdmin) {
      q = query(collection(db, 'users'));
    } else if (isNegeriScoped) {
      q = query(collection(db, 'users'), where('negeri', '==', adminNegeri));
    } else {
      q = query(collection(db, 'users'));
    }
    const unsub = onSnapshot(q, (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, [isSuperAdmin, isNegeriScoped, adminNegeri, isAnyAdmin]);

  // Roles this admin can create
  const creatableRoles: UserRole[] = isSuperAdmin
    ? ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai']
    : ['pegawai_daerah', 'pegawai']; // admin_negeri can only create pegawai

  // Auto-format: Capitalize Each Word
  const capitalizeWords = (str: string) =>
    str.replace(/\b[\p{L}']+/gu, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.nama) {
      toast.error('Sila isi email, kata laluan, dan nama.');
      return;
    }
    setFormLoading(true);
    try {
      const negeriToAssign = isNegeriScoped ? adminNegeri : form.negeri;
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          nama: form.nama,
          noPerkerja: form.noPerkerja,
          negeri: negeriToAssign,
          daerah: form.daerah,
          role: form.role,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Pengguna berjaya dicipta!');
      setShowForm(false);
      setForm({ email: '', password: '', nama: '', noPerkerja: '', negeri: '', daerah: '', role: 'pegawai' });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Gagal mencipta.');
    }
    setFormLoading(false);
  };

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success('Role dikemas kini!');
      setEditingUser(null);
    } catch (e) {
      toast.error('Gagal kemaskini.');
    }
  };

  const handleUpdateNegeri = async (uid: string, negeri: string) => {
    try {
      await updateDoc(doc(db, 'users', uid), { negeri });
      toast.success('Negeri dikemas kini!');
    } catch (e) {
      toast.error('Gagal kemaskini.');
    }
  };

  const handleDelete = async (uid: string, nama: string) => {
    if (!confirm(`Padam "${nama}"?`)) return;
    try {
      const res = await fetch('/api/admin/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });
      if (!res.ok) throw new Error('Gagal');
      toast.success('Pengguna dipadam.');
    } catch (e) {
      toast.error('Gagal memadam.');
    }
  };

  const filtered = users.filter(u => {
    if (filterRole === 'Semua') return true;
    return u.role === filterRole;
  });

  if (!isAnyAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-forest">Panel Admin</h2>
          <p className="text-xs text-gray-500">
            {isSuperAdmin ? 'Super Admin — Akses penuh' : `Admin ${adminNegeri} — Urus pegawai negeri`}
          </p>
        </div>
        {canCreateUser && (
          <button onClick={() => setShowForm(!showForm)}
            className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md active:scale-95">
            {showForm ? '✕ Tutup' : '+ Tambah User'}
          </button>
        )}
      </div>

      {/* Super Admin — Settings Link */}
      {isSuperAdmin && (
        <Link href="/admin/settings"
          className="block bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 hover:bg-purple-100 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚙️</span>
              <div>
                <p className="text-sm font-bold text-purple-700">Tetapan Akses Halaman</p>
                <p className="text-[9px] text-purple-500">Kawal halaman mana boleh diakses oleh role mana</p>
              </div>
            </div>
            <span className="text-purple-400">→</span>
          </div>
        </Link>
      )}

      {/* Role Info */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <h4 className="text-xs font-bold text-gray-600 mb-2">Hierarki Role:</h4>
        <div className="flex flex-wrap gap-2">
          {ALL_ROLES.map(role => (
            <span key={role} className={`text-[9px] px-2 py-1 rounded-full font-bold ${ROLE_COLORS[role]}`}>
              {ROLE_LABELS[role]}
            </span>
          ))}
        </div>
        {isNegeriScoped && (
          <p className="text-[9px] text-orange-600 mt-2 bg-orange-50 px-2 py-1 rounded">
            📍 Anda hanya boleh urus pengguna di negeri <strong>{adminNegeri}</strong>
          </p>
        )}
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-gold space-y-3">
          <h3 className="font-bold text-forest text-sm">Pengguna Baru</h3>
          <div className="grid grid-cols-2 gap-3">
            <input type="email" placeholder="Email *" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" required />
            <input type="password" placeholder="Kata Laluan * (min 6)" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" required minLength={6} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Nama Penuh *" value={form.nama}
              onChange={(e) => setForm({ ...form, nama: capitalizeWords(e.target.value) })}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" required />
            <input placeholder="No. Pekerja" value={form.noPerkerja}
              onChange={(e) => setForm({ ...form, noPerkerja: e.target.value })}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {isNegeriScoped ? (
              <input value={adminNegeri} readOnly className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-100 font-semibold" />
            ) : (
              <select value={form.negeri} onChange={(e) => setForm({ ...form, negeri: e.target.value })}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50">
                <option value="">Negeri</option>
                {SENARAI_NEGERI.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            <input placeholder="Daerah" value={form.daerah}
              onChange={(e) => setForm({ ...form, daerah: capitalizeWords(e.target.value) })}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 font-semibold">
              {creatableRoles.map(r => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={formLoading}
            className="w-full bg-gradient-gold text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
            {formLoading ? 'Mencipta...' : '✓ Cipta Pengguna'}
          </button>
        </form>
      )}

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['Semua', ...ALL_ROLES].map(r => (
          <button key={r} onClick={() => setFilterRole(r)}
            className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
              filterRole === r ? 'bg-forest text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}>
            {r === 'Semua' ? 'Semua' : ROLE_LABELS[r as UserRole]}
          </button>
        ))}
      </div>

      {/* User List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div>)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.uid} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-forest text-sm">{u.nama}</h4>
                    <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{u.email}</p>
                  <p className="text-[10px] text-gray-400">{u.noPerkerja || '-'} &bull; {u.negeri || '-'} &bull; {u.daerah || '-'}</p>

                  {/* Edit controls */}
                  {editingUser === u.uid ? (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {(isSuperAdmin ? ALL_ROLES : creatableRoles).map(r => (
                        <button key={r} onClick={() => handleUpdateRole(u.uid, r)}
                          className={`text-[8px] px-2 py-1 rounded-lg font-medium ${u.role === r ? 'bg-forest text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[r].split(' ').slice(1).join(' ')}
                        </button>
                      ))}
                      <button onClick={() => setEditingUser(null)} className="text-[8px] text-gray-400 ml-1">✕</button>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2 items-center">
                      {(isSuperAdmin || (isAdminNegeri && u.role !== 'superadmin' && u.role !== 'admin_negeri')) && (
                        <button onClick={() => setEditingUser(u.uid)} className="text-[9px] text-forest underline">Tukar Role</button>
                      )}
                      {isSuperAdmin && (
                        <select value={u.negeri || ''} onChange={(e) => handleUpdateNegeri(u.uid, e.target.value)}
                          className="text-[9px] px-2 py-0.5 border border-gray-200 rounded-lg bg-gray-50">
                          <option value="">Negeri</option>
                          {SENARAI_NEGERI.map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                </div>
                {u.uid !== profile?.uid && isSuperAdmin && (
                  <button onClick={() => handleDelete(u.uid, u.nama)} className="text-gray-300 hover:text-red-500 text-lg ml-2">×</button>
                )}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-gray-400 text-center pt-2">
            Jumlah: {filtered.length} pengguna
          </p>
        </div>
      )}
    </div>
  );
}
