'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { formatNamaPaparan } from '@/lib/constants';
import { ringkasanPemantauan, kesanBackdate } from '@/lib/lawatan';
import { formatTarikhBM, statusPemantauan } from '@/lib/unjuran';
import { useTarikhSemasa } from '@/lib/useTarikhSemasa';

interface LawatanRecord {
  id: string;
  key: string;
  kebunId: string;
  tarikhLawatan: string;
  fasaUtama: string;
  varieti: string;
  jumlahPokok: number;
  totalKg: number;
  totalTan: number;
  pegawaiNama: string;
  pegawaiDaerah: string;
  saizKebun: number;
  createdAtSeconds: number;
}

interface KebunInfo {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
}

// Satu baris ringkasan per kebun untuk paparan kad pemantauan.
interface KadPemantauan {
  kebunId: string;
  kebunNama: string;
  negeri: string;
  daerah: string;
  bilangan: number;
  terkiniTarikh?: string;
  terkiniPegawai?: string;
  terkiniCreatedAt: number;
  bilBackdate: number;
  bilLewatRekod: number;
  statusPmt: string; // 'tiada'|'semasa'|'hampir'|'lewat'|...
  hariSejak: number | null;
  keparahan: number; // untuk susunan: makin tinggi makin perlu perhatian
  rekod: LawatanRecord[];
}

export default function AdminDashboardPage() {
  const { profile, isAnyAdmin, isSuperAdmin, isAdminNegeri, loading: authLoading } = useAuth();
  const userNegeri = profile?.negeri?.trim() || '';
  const router = useRouter();
  const tarikhSemasa = useTarikhSemasa();
  const [records, setRecords] = useState<LawatanRecord[]>([]);
  const [kebunInfo, setKebunInfo] = useState<Record<string, KebunInfo>>({});
  const [loading, setLoading] = useState(true);
  const [filterDaerah, setFilterDaerah] = useState('');
  const [filterPegawai, setFilterPegawai] = useState('');
  const [sejarahDibuka, setSejarahDibuka] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && profile && !isAnyAdmin) router.replace('/');
  }, [authLoading, profile, isAnyAdmin, router]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAnyAdmin || (isAdminNegeri && !userNegeri)) {
      setRecords([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setRecords([]);
    const kebunQuery = isSuperAdmin
      ? query(collection(db, 'kebun'))
      : query(collection(db, 'kebun'), where('negeri', '==', userNegeri));

    let lawatanUnsubs: (() => void)[] = [];
    const unsubscribeKebun = onSnapshot(kebunQuery, (kebunSnap) => {
      lawatanUnsubs.forEach(unsub => unsub());
      lawatanUnsubs = [];
      const recordsByKebun = new Map<string, LawatanRecord[]>();

      // Simpan maklumat kebun untuk paparan kad.
      const infoMap: Record<string, KebunInfo> = {};
      kebunSnap.docs.forEach(kd => {
        const d = kd.data();
        infoMap[kd.id] = {
          id: kd.id,
          nama: d.nama || '',
          negeri: d.negeri || '',
          daerah: d.daerah || '',
        };
      });
      setKebunInfo(infoMap);

      if (kebunSnap.empty) {
        setRecords([]);
        setLoading(false);
        return;
      }

      const publish = () => {
        const rows = Array.from(recordsByKebun.values()).flat()
          .sort((a, b) => (b.tarikhLawatan || '').localeCompare(a.tarikhLawatan || ''));
        setRecords(rows);
        setLoading(false);
      };

      lawatanUnsubs = kebunSnap.docs.map(kebunDoc => onSnapshot(
        query(collection(db, 'kebun', kebunDoc.id, 'lawatan')),
        (snapshot) => {
          recordsByKebun.set(kebunDoc.id, snapshot.docs.map(lawatanDoc => {
            const data = lawatanDoc.data();
            const varieti = Array.isArray(data.varietiResults)
              ? data.varietiResults.map((v: { name?: string }) => v.name).filter(Boolean).join(', ')
              : data.varieti || '-';
            return {
              id: lawatanDoc.id,
              key: lawatanDoc.ref.path,
              kebunId: kebunDoc.id,
              tarikhLawatan: data.tarikhLawatan || '',
              fasaUtama: typeof data.fasaUtama === 'string' ? data.fasaUtama : '',
              varieti,
              jumlahPokok: data.jumlahPokok || 0,
              totalKg: data.totalKg || 0,
              totalTan: data.totalTan || 0,
              pegawaiNama: data.pegawaiNama || '',
              pegawaiDaerah: data.pegawaiDaerah || data.daerah || '',
              saizKebun: data.saizKebun || 0,
              createdAtSeconds: data.createdAt?.seconds || 0,
            } as LawatanRecord;
          }));
          publish();
        }
      ));
    });

    return () => {
      unsubscribeKebun();
      lawatanUnsubs.forEach(unsub => unsub());
    };
  }, [authLoading, isAnyAdmin, isSuperAdmin, isAdminNegeri, userNegeri]);

  const filtered = records.filter((r) => {
    if (filterDaerah && !r.pegawaiDaerah?.toLowerCase().includes(filterDaerah.toLowerCase())) {
      return false;
    }
    if (filterPegawai && !r.pegawaiNama?.toLowerCase().includes(filterPegawai.toLowerCase())) {
      return false;
    }
    return true;
  });

  // Bina kad pemantauan per kebun dari rekod yang ditapis.
  const kadList = useMemo<KadPemantauan[]>(() => {
    const perKebun = new Map<string, LawatanRecord[]>();
    filtered.forEach(r => {
      const arr = perKebun.get(r.kebunId) || [];
      arr.push(r);
      perKebun.set(r.kebunId, arr);
    });

    const kad: KadPemantauan[] = [];
    perKebun.forEach((rekod, kebunId) => {
      const info = kebunInfo[kebunId];
      const ring = ringkasanPemantauan(rekod.map(r => ({
        kebunId: r.kebunId,
        tarikhLawatan: r.tarikhLawatan,
        createdAt: { seconds: r.createdAtSeconds },
        pegawaiNama: r.pegawaiNama,
      })));
      const pmt = statusPemantauan(ring.terkini?.tarikhLawatan, tarikhSemasa);

      // Keparahan: backdate > lewat pemantauan > lewat rekod > hampir > normal.
      let keparahan = 0;
      if (ring.bilBackdate > 0) keparahan += 100;
      if (pmt.status === 'lewat') keparahan += 50;
      if (pmt.status === 'hampir') keparahan += 20;
      if (ring.bilLewatRekod > 0) keparahan += 10;

      kad.push({
        kebunId,
        kebunNama: info?.nama || rekod[0]?.varieti || '(Kebun)',
        negeri: info?.negeri || '',
        daerah: info?.daerah || rekod[0]?.pegawaiDaerah || '',
        bilangan: ring.bilangan,
        terkiniTarikh: ring.terkini?.tarikhLawatan,
        terkiniPegawai: ring.terkini?.pegawaiNama,
        terkiniCreatedAt: ring.terkini?.createdAtSeconds || 0,
        bilBackdate: ring.bilBackdate,
        bilLewatRekod: ring.bilLewatRekod,
        statusPmt: pmt.status,
        hariSejak: pmt.hariSejakLawatan,
        keparahan,
        rekod: [...rekod].sort((a, b) => (b.createdAtSeconds - a.createdAtSeconds)),
      });
    });

    // Susun: paling perlu perhatian di atas, kemudian ikut nama.
    return kad.sort((a, b) => b.keparahan - a.keparahan || a.kebunNama.localeCompare(b.kebunNama, 'ms'));
  }, [filtered, kebunInfo, tarikhSemasa]);

  const perluPerhatian = kadList.filter(k => k.keparahan > 0).length;

  const totalKg = filtered.reduce((sum, r) => sum + (r.totalKg || 0), 0);
  const uniquePegawai = new Set(filtered.map((r) => r.pegawaiNama)).size;

  const toggleSejarah = (kebunId: string) => {
    setSejarahDibuka(prev => {
      const next = new Set(prev);
      if (next.has(kebunId)) next.delete(kebunId);
      else next.add(kebunId);
      return next;
    });
  };

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

  if (!isAnyAdmin) return null;

  // Warna kad ikut keadaan paling teruk.
  const gayaKad = (k: KadPemantauan) => {
    if (k.bilBackdate > 0 || k.statusPmt === 'lewat') return 'border-red-200 bg-red-50';
    if (k.statusPmt === 'hampir' || k.bilLewatRekod > 0) return 'border-amber-200 bg-amber-50';
    return 'border-green-200 bg-green-50';
  };
  const ikonKad = (k: KadPemantauan) => {
    if (k.bilBackdate > 0 || k.statusPmt === 'lewat') return '🔴';
    if (k.statusPmt === 'hampir' || k.bilLewatRekod > 0) return '🟡';
    return '🟢';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/admin/pegawai')} className="text-forest text-xl">
          ←
        </button>
        <h2 className="text-xl font-bold text-forest">Dashboard Admin</h2>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Kebun</p>
          <p className="text-xl font-bold text-forest">{kadList.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Lawatan</p>
          <p className="text-xl font-bold text-forest">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Pegawai</p>
          <p className="text-xl font-bold text-forest">{uniquePegawai}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center">
          <p className="text-[10px] text-gray-500">Perlu Perhatian</p>
          <p className={`text-xl font-bold ${perluPerhatian > 0 ? 'text-red-600' : 'text-forest'}`}>{perluPerhatian}</p>
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

      {/* Kad Pemantauan per Kebun */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : kadList.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">Tiada rekod pemantauan.</p>
      ) : (
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {kadList.map((k) => {
            const dibuka = sejarahDibuka.has(k.kebunId);
            return (
              <div key={k.kebunId} className={`rounded-xl border p-3 text-xs ${gayaKad(k)}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-gray-800 truncate">
                      {ikonKad(k)} {formatNamaPaparan(k.kebunNama)}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {formatNamaPaparan(k.daerah)}{k.negeri ? `, ${k.negeri}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-forest">{k.bilangan}x</p>
                    <p className="text-[9px] text-gray-400">pemantauan</p>
                  </div>
                </div>

                <div className="mt-1.5 text-[10px] text-gray-600">
                  Terakhir: {k.terkiniTarikh ? formatTarikhBM(k.terkiniTarikh) : '-'}
                  {k.terkiniPegawai ? ` · ${formatNamaPaparan(k.terkiniPegawai)}` : ''}
                  {k.hariSejak !== null && k.hariSejak >= 0 ? ` · ${k.hariSejak} hari lalu` : ''}
                </div>

                {/* Bendera perhatian */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {k.statusPmt === 'lewat' && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">🔴 Lewat pemantauan</span>
                  )}
                  {k.statusPmt === 'hampir' && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">🟡 Hampir perlu pantau</span>
                  )}
                  {k.bilBackdate > 0 && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">🚩 {k.bilBackdate} rekod direkod lewat (lebih 14 hari)</span>
                  )}
                  {k.bilLewatRekod > 0 && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">⚠ {k.bilLewatRekod} rekod direkod lewat (4-14 hari)</span>
                  )}
                  {k.keparahan === 0 && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">✅ Semua rekod normal</span>
                  )}
                </div>

                {/* Butang lihat sejarah penuh */}
                <button
                  onClick={() => toggleSejarah(k.kebunId)}
                  className="mt-2 text-[10px] font-semibold text-forest underline"
                >
                  {dibuka ? 'Sembunyi sejarah' : 'Lihat sejarah penuh'}
                </button>

                {dibuka && (
                  <div className="mt-2 space-y-1 border-t border-black/5 pt-2">
                    {k.rekod.map((r) => {
                      const bd = kesanBackdate(r.tarikhLawatan, r.createdAtSeconds);
                      const disimpan = r.createdAtSeconds
                        ? new Date(r.createdAtSeconds * 1000).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '-';
                      return (
                        <div key={r.key} className="text-[9px] text-gray-600">
                          <span className="font-bold text-gray-800">{formatTarikhBM(r.tarikhLawatan)}</span>
                          {r.varieti ? ` · ${r.varieti}` : ''}
                          {` · direkod ${disimpan}`}
                          {r.pegawaiNama ? ` · ${formatNamaPaparan(r.pegawaiNama)}` : ''}
                          {bd.status === 'lewat' && (
                            <span className="ml-1 rounded bg-amber-100 px-1 py-0.5 font-bold text-amber-700">⚠ {bd.hariJurang} hari</span>
                          )}
                          {bd.status === 'backdate' && (
                            <span className="ml-1 rounded bg-red-100 px-1 py-0.5 font-bold text-red-700">🚩 {bd.hariJurang} hari</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Total & Export */}
      <div className="bg-white rounded-xl p-3 shadow-sm text-center text-xs text-gray-600">
        Jumlah anggaran hasil: <span className="font-bold text-forest">{(totalKg / 1000).toFixed(2)} MT</span>
      </div>
      <button
        onClick={handleExportCSV}
        className="w-full border border-forest text-forest py-3 rounded-lg text-sm font-semibold hover:bg-forest/5"
      >
        📥 Muat Turun CSV
      </button>
    </div>
  );
}
