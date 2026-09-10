'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collectionGroup, collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SENARAI_NEGERI, negeriDariDaerah, formatMasaBM } from '@/lib/constants';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface LawatanRow {
  id: string;          // id dokumen lawatan
  refPath: string;     // path penuh dokumen di Firestore (untuk update/delete tepat)
  kebunId: string;     // id kebun (parent, jika ada)
  kebunNama: string;
  negeri: string;
  daerah: string;
  pegawaiNama: string;
  pegawaiDaerah: string;
  tarikhLawatan: string;
  totalKg: number;
  createdAtSeconds: number;
}

interface KebunLite {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
}

export default function DataLawatanPage() {
  const { profile, isSuperAdmin } = useAuth();
  const router = useRouter();
  const [lawatan, setLawatan] = useState<LawatanRow[]>([]);
  const [kebun, setKebun] = useState<KebunLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pilihNegeri, setPilihNegeri] = useState<Record<string, string>>({});

  // Hanya superadmin
  useEffect(() => {
    if (profile && !isSuperAdmin) router.push('/');
  }, [profile, isSuperAdmin, router]);

  useEffect(() => {
    const unsub = onSnapshot(query(collectionGroup(db, 'lawatan')), (snap) => {
      const rows: LawatanRow[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          refPath: d.ref.path,
          kebunId: data.kebunId || d.ref.parent.parent?.id || '',
          kebunNama: data.kebunNama || '',
          negeri: data.negeri || '',
          daerah: data.daerah || '',
          pegawaiNama: data.pegawaiNama || '',
          pegawaiDaerah: data.pegawaiDaerah || '',
          tarikhLawatan: data.tarikhLawatan || '',
          totalKg: data.totalKg || 0,
          createdAtSeconds: data.createdAt?.seconds || 0,
        };
      });
      setLawatan(rows);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'kebun')), (snap) => {
      setKebun(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<KebunLite, 'id'>) })));
    });
    return () => unsub();
  }, []);

  // Peta kebun ikut id & nama untuk pemulihan negeri
  const { kebunById, kebunByNama } = useMemo(() => {
    const byId: Record<string, KebunLite> = {};
    const byNama: Record<string, KebunLite> = {};
    kebun.forEach(k => {
      byId[k.id] = k;
      if (k.nama) byNama[k.nama.trim().toLowerCase()] = k;
    });
    return { kebunById: byId, kebunByNama: byNama };
  }, [kebun]);

  // Tentukan negeri yang dapat dikenal pasti bagi satu rekod
  const resolveNegeri = (l: LawatanRow): string => {
    const dariKebun = (l.kebunId && kebunById[l.kebunId])
      || (l.kebunNama && kebunByNama[l.kebunNama.trim().toLowerCase()])
      || undefined;
    return (l.negeri && l.negeri.trim())
      || (dariKebun?.negeri && dariKebun.negeri.trim())
      || negeriDariDaerah(l.daerah)
      || negeriDariDaerah(dariKebun?.daerah)
      || negeriDariDaerah(l.pegawaiDaerah)
      || '';
  };

  // Rekod bermasalah: negeri tak dapat dikenal pasti
  const bermasalah = useMemo(
    () => lawatan.filter(l => !resolveNegeri(l)).sort((a, b) => b.createdAtSeconds - a.createdAtSeconds),
    [lawatan, kebunById, kebunByNama]
  );

  const tarikhPapar = (l: LawatanRow) => {
    if (l.tarikhLawatan) return l.tarikhLawatan;
    if (l.createdAtSeconds) return new Date(l.createdAtSeconds * 1000).toLocaleDateString('ms-MY');
    return '-';
  };

  const handleTetapkan = async (l: LawatanRow) => {
    const negeri = pilihNegeri[l.id];
    if (!negeri) { toast.error('Sila pilih negeri dahulu.'); return; }
    setBusyId(l.id);
    try {
      // Guna path penuh dokumen supaya berfungsi di mana-mana lokasi rekod disimpan
      await updateDoc(doc(db, l.refPath), { negeri });
      toast.success(`Negeri ditetapkan: ${negeri}`);
    } catch (e) {
      console.error('Update gagal:', e);
      toast.error(e instanceof Error ? `Gagal: ${e.message}` : 'Gagal mengemas kini rekod.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePadam = async (l: LawatanRow) => {
    if (!confirm(`Padam rekod lawatan ini?\nKebun: ${l.kebunNama || '-'}\nTarikh: ${tarikhPapar(l)}\nHasil: ${(l.totalKg/1000).toFixed(2)} MT`)) return;
    setBusyId(l.id);
    try {
      await deleteDoc(doc(db, l.refPath));
      toast.success('Rekod lawatan dipadam.');
    } catch (e) {
      console.error('Padam gagal:', e);
      toast.error(e instanceof Error ? `Gagal: ${e.message}` : 'Gagal memadam rekod.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isSuperAdmin) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-forest text-xl">←</button>
        <div>
          <h2 className="text-lg font-bold text-forest">Pembersihan Data Lawatan</h2>
          <p className="text-xs text-gray-500">Betulkan rekod yang negerinya tidak dapat dikenal pasti</p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-[11px] text-amber-800">
          Rekod di bawah menyumbang kepada label <strong>&quot;Negeri Tidak Direkod&quot;</strong> dalam dashboard.
          Tetapkan negeri yang betul, atau padam jika rekod tidak sah.
        </p>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Memuatkan rekod lawatan...</p>
        </div>
      ) : bermasalah.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <span>🟢</span>
          <p className="text-sm text-green-700 font-medium">
            Tiada rekod bermasalah. Semua lawatan mempunyai negeri yang dikenal pasti.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">{bermasalah.length} rekod perlu diperbetulkan</p>
          {bermasalah.map(l => (
            <div key={l.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-forest truncate">{l.kebunNama || '(Kebun tidak dinamakan)'}</p>
                  <p className="text-[10px] text-gray-500">
                    Tarikh: {tarikhPapar(l)} &bull; {(l.totalKg / 1000).toFixed(2)} MT
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Pegawai: {l.pegawaiNama || '-'} &bull; Daerah: {l.daerah || l.pegawaiDaerah || '-'}
                  </p>
                  {l.createdAtSeconds > 0 && (
                    <p className="text-[9px] text-gray-300">Direkod: {formatMasaBM(new Date(l.createdAtSeconds * 1000))}</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <select
                  value={pilihNegeri[l.id] || ''}
                  onChange={(e) => setPilihNegeri(prev => ({ ...prev, [l.id]: e.target.value }))}
                  className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg bg-gray-50 flex-1 min-w-[140px]"
                >
                  <option value="">-- Pilih Negeri --</option>
                  {SENARAI_NEGERI.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <button
                  onClick={() => handleTetapkan(l)}
                  disabled={busyId === l.id}
                  className="text-xs bg-forest text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                >
                  {busyId === l.id ? '...' : '✓ Tetapkan'}
                </button>
                <button
                  onClick={() => handlePadam(l)}
                  disabled={busyId === l.id}
                  className="text-xs border border-red-300 text-red-500 px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                >
                  🗑️ Padam
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
