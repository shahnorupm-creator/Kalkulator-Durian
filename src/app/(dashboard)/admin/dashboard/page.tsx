'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collectionGroup, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

interface LawatanRecord {
  id: string;
  tarikhLawatan: string;
  varieti: string;
  jumlahPokok: number;
  totalKg: number;
  totalTan: number;
  pegawaiNama: string;
  pegawaiDaerah: string;
  saizKebun: number;
}

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [records, setRecords] = useState<LawatanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDaerah, setFilterDaerah] = useState('');
  const [filterPegawai, setFilterPegawai] = useState('');

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      router.push('/');
    }
  }, [profile, router]);

  useEffect(() => {
    const q = query(collectionGroup(db, 'lawatan'), orderBy('tarikhLawatan', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: LawatanRecord[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LawatanRecord[];
      setRecords(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = records.filter((r) => {
    if (filterDaerah && !r.pegawaiDaerah?.toLowerCase().includes(filterDaerah.toLowerCase())) {
      return false;
    }
    if (filterPegawai && !r.pegawaiNama?.toLowerCase().includes(filterPegawai.toLowerCase())) {
      return false;
    }
    return true;
  });

  const totalKg = filtered.reduce((sum, r) => sum + (r.totalKg || 0), 0);
  const uniquePegawai = new Set(filtered.map((r) => r.pegawaiNama)).size;
  const uniqueDaerah = new Set(filtered.map((r) => r.pegawaiDaerah).filter(Boolean));

  const handleExportCSV = () => {
    const headers = [
      'Tarikh',
      'Pegawai',
      'Daerah',
      'Varieti',
      'Saiz Kebun (ekar)',
      'Jumlah Pokok',
      'Anggaran (kg)',
      'Anggaran (tan)',
    ];
    const rows = filtered.map((r) => [
      r.tarikhLawatan,
      r.pegawaiNama,
      r.pegawaiDaerah,
      r.varieti,
      r.saizKebun,
      r.jumlahPokok,
      r.totalKg?.toFixed(2),
      r.totalTan?.toFixed(3),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `laporan_durian_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (profile?.role !== 'admin') return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/admin/pegawai')} className="text-forest text-xl">
          ←
        </button>
        <h2 className="text-xl font-bold text-forest">Dashboard Admin</h2>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Lawatan</p>
          <p className="text-xl font-bold text-forest">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Jumlah (kg)</p>
          <p className="text-xl font-bold text-forest">{totalKg.toFixed(0)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Pegawai</p>
          <p className="text-xl font-bold text-forest">{uniquePegawai}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          placeholder="Filter daerah..."
          value={filterDaerah}
          onChange={(e) => setFilterDaerah(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        />
        <input
          type="text"
          placeholder="Filter pegawai..."
          value={filterPegawai}
          onChange={(e) => setFilterPegawai(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
        />
      </div>

      {/* Records */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl p-3 shadow-sm text-xs">
              <div className="flex justify-between">
                <div>
                  <p className="font-semibold text-forest">{r.pegawaiNama}</p>
                  <p className="text-gray-500">
                    {r.pegawaiDaerah} &middot; {r.varieti}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-forest">{r.totalKg?.toFixed(1)} kg</p>
                  <p className="text-gray-400">{r.tarikhLawatan}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export */}
      <button
        onClick={handleExportCSV}
        className="w-full border border-forest text-forest py-3 rounded-lg text-sm font-semibold hover:bg-forest/5"
      >
        📥 Muat Turun CSV
      </button>
    </div>
  );
}
