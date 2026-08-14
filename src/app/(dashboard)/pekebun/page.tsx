'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

interface Pekebun {
  id: string;
  nama: string;
  daerah: string;
  mukim: string;
  alamatKebun: string;
  lat: string;
  long: string;
  createdAt?: Date;
}

export default function PekebunListPage() {
  const { user } = useAuth();
  const [pekebunList, setPekebunList] = useState<Pekebun[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'users', user.uid, 'pekebun'),
      orderBy('nama')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Pekebun[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Pekebun[];
      setPekebunList(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filtered = pekebunList.filter(
    (p) =>
      p.nama.toLowerCase().includes(search.toLowerCase()) ||
      p.daerah.toLowerCase().includes(search.toLowerCase()) ||
      p.mukim.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-forest">Senarai Pekebun</h2>
        <Link
          href="/pekebun/tambah"
          className="bg-forest text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-moss transition-colors"
        >
          + Tambah
        </Link>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Cari nama, daerah, atau mukim..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest bg-white"
      />

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <span className="text-4xl block mb-3">👨‍🌾</span>
          <p className="text-gray-500 text-sm">
            {search ? 'Tiada pekebun dijumpai.' : 'Belum ada pekebun didaftarkan.'}
          </p>
          {!search && (
            <Link
              href="/pekebun/tambah"
              className="inline-block mt-3 text-forest text-sm font-semibold underline"
            >
              Tambah pekebun pertama
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/pekebun/${p.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-moss"
            >
              <h3 className="font-semibold text-forest">{p.nama}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {p.daerah} &middot; {p.mukim}
              </p>
              <p className="text-xs text-gray-400 mt-1 truncate">
                📍 {p.alamatKebun || 'Tiada alamat'}
              </p>
            </Link>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Jumlah: {filtered.length} pekebun
      </p>
    </div>
  );
}
