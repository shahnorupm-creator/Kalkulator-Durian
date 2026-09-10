'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { collectionGroup, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NEGERI_FLAG_COLORS, NEGERI_FLAG, VARIETIES, negeriDariDaerah } from '@/lib/constants';
import { pilihLawatanSemasaPerKebun } from '@/lib/lawatan';

interface LawatanRecord {
  id: string;
  tarikhLawatan: string;
  varieti: string;
  varietiKey: string;
  jumlahPokok: number;
  totalKg: number;
  totalTan: number;
  saizKebun: number;
  pegawaiNama: string;
  pegawaiDaerah: string;
  negeri: string;
  daerah: string;
  kebunId: string;
  kebunNama: string;
  fasa: string;
  fasaUtama: string;
  varietiResults?: { key: string; name: string; pokok: number; kg: number }[];
  createdAt?: { seconds?: number } | null;
  updatedAt?: { seconds?: number } | null;
}

interface VarietiEntry {
  usia: string;
  varieti: string;
  bilangan: number;
}

interface KebunRecord {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
  saizKebun: number;
  kepadatan: number;
  pctMatang: number;
  jumlahPokok: number;
  varietiData?: VarietiEntry[];
}

export default function DashboardHQPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const canViewNationalDashboard = profile?.role === 'superadmin' || profile?.role === 'admin_hq';
  const { t } = useLanguage();
  const [lawatan, setLawatan] = useState<LawatanRecord[]>([]);
  const [kebun, setKebun] = useState<KebunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  // Varieti yang sedang dilihat (hover/klik) untuk pop-out MT
  const [activeVarieti, setActiveVarieti] = useState<string | null>(null);
  // Bulan yang sedang dilihat (hover/klik) untuk pop-out senarai negeri
  const [activeBulan, setActiveBulan] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !canViewNationalDashboard) router.replace('/');
  }, [authLoading, canViewNationalDashboard, router]);

  useEffect(() => {
    if (!canViewNationalDashboard) {
      setLawatan([]);
      setLoading(false);
      return;
    }
    const q = query(collectionGroup(db, 'lawatan'));
    const unsub = onSnapshot(q, (snap) => {
      setLawatan(snap.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          kebunId: data.kebunId || d.ref.parent.parent?.id || '',
        } as LawatanRecord;
      }));
      setLoading(false);
    });
    return () => unsub();
  }, [canViewNationalDashboard]);

  useEffect(() => {
    if (!canViewNationalDashboard) {
      setKebun([]);
      return;
    }
    const q = query(collection(db, 'kebun'));
    const unsub = onSnapshot(q, (snap) => {
      setKebun(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
    });
    return () => unsub();
  }, [canViewNationalDashboard]);

  // Satu rekod pemantauan semasa bagi setiap kebun:
  // tarikh lawatan paling baharu, kemudian masa simpan/kemas kini paling baharu.
  const latestLawatan = useMemo(() => {
    const kebunSah = new Set(kebun.map(k => k.id));
    return pilihLawatanSemasaPerKebun(lawatan, kebunSah);
  }, [lawatan, kebun]);

  // KPI Stats
  const kpi = useMemo(() => {
    const totalKebun = kebun.length;
    const totalEkar = kebun.reduce((s, k) => s + (k.saizKebun || 0), 0);
    const totalPokok = kebun.reduce((s, k) => s + (k.jumlahPokok || 0), 0);
    const totalKg = latestLawatan.reduce((s, l) => s + (l.totalKg || 0), 0);
    const totalMT = totalKg / 1000;
    const negeriAktif = new Set(kebun.map(k => k.negeri).filter(Boolean)).size;
    const totalLawatan = latestLawatan.length;
    return { totalKebun, totalEkar, totalPokok, totalKg, totalMT, negeriAktif, totalLawatan };
  }, [kebun, latestLawatan]);

  // Top negeri by ekar
  const negeriRanking = useMemo(() => {
    const map: Record<string, { kebun: number; ekar: number; pokok: number; kg: number }> = {};
    const kebunById = new Map(kebun.map(k => [k.id, k]));
    kebun.forEach(k => {
      const n = (k.negeri && k.negeri.trim()) || negeriDariDaerah(k.daerah) || 'Negeri Tidak Direkod';
      if (!map[n]) map[n] = { kebun: 0, ekar: 0, pokok: 0, kg: 0 };
      map[n].kebun += 1;
      map[n].ekar += k.saizKebun || 0;
      map[n].pokok += k.jumlahPokok || 0;
    });
    latestLawatan.forEach(l => {
      const farm = kebunById.get(l.kebunId);
      if (!farm) return;
      const n = (farm.negeri && farm.negeri.trim()) || negeriDariDaerah(farm.daerah) || 'Negeri Tidak Direkod';
      if (map[n]) map[n].kg += l.totalKg || 0;
    });
    return Object.entries(map).map(([negeri, d]) => ({ negeri, ...d })).sort((a, b) => b.ekar - a.ekar);
  }, [kebun, latestLawatan]);

  // Taburan varieti daripada rekod pemantauan semasa yang sama dengan KPI.
  // Rekod lama tanpa varietiResults diagihkan mengikut wajaran profil kebun,
  // tetapi jumlah kg kekal tepat sama dengan totalKg lawatan semasa.
  const varietiDist = useMemo(() => {
    const capitalizeWords = (str: string) =>
      str.replace(/\b[\p{L}']+/gu, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    const namaVarieti = (nama?: string, key?: string) => {
      const raw = (nama || key || '').trim();
      const ref = VARIETIES.find(
        x => x.key === key || x.key === raw || x.name === raw || x.name.toLowerCase() === raw.toLowerCase()
      );
      return ref?.name || (raw ? capitalizeWords(raw) : 'Belum Diperincikan');
    };

    const map: Record<string, { kg: number; pokok: number }> = {};
    const kebunById = new Map(kebun.map(k => [k.id, k]));
    const tambah = (name: string, kg: number, pokok: number) => {
      if (!map[name]) map[name] = { kg: 0, pokok: 0 };
      map[name].kg += kg;
      map[name].pokok += pokok;
    };

    latestLawatan.forEach(l => {
      const jumlahKg = Math.max(0, Number(l.totalKg) || 0);
      const pecahan = (l.varietiResults || []).filter(v => (Number(v.kg) || 0) > 0);
      const jumlahPecahan = pecahan.reduce((sum, v) => sum + (Number(v.kg) || 0), 0);

      if (jumlahPecahan > 0) {
        // Skala kecil ini memastikan jumlah semua kategori sentiasa sama tepat dengan totalKg rekod.
        const faktor = jumlahKg / jumlahPecahan;
        pecahan.forEach(v => {
          tambah(
            namaVarieti(v.name, v.key),
            (Number(v.kg) || 0) * faktor,
            Math.max(0, Number(v.pokok) || 0)
          );
        });
        return;
      }

      // Fallback rekod lama: agih totalKg mengikut potensi hasil varieti dalam profil kebun.
      const farm = kebunById.get(l.kebunId);
      const profil = (farm?.varietiData || [])
        .map(v => {
          const bilangan = Math.max(0, Number(v.bilangan) || 0);
          const ref = VARIETIES.find(
            x => x.key === v.varieti || x.name === v.varieti || x.name.toLowerCase() === (v.varieti || '').toLowerCase()
          );
          return {
            name: namaVarieti(v.varieti, ref?.key),
            pokok: bilangan,
            wajaran: bilangan * (ref?.hasil ?? 150),
          };
        })
        .filter(v => v.wajaran > 0);
      const jumlahWajaran = profil.reduce((sum, v) => sum + v.wajaran, 0);

      if (jumlahWajaran > 0) {
        profil.forEach(v => tambah(v.name, jumlahKg * (v.wajaran / jumlahWajaran), v.pokok));
      } else {
        tambah(namaVarieti(l.varieti, l.varietiKey), jumlahKg, Math.max(0, Number(l.jumlahPokok) || 0));
      }
    });

    const total = Object.values(map).reduce((s, v) => s + v.kg, 0);
    return Object.entries(map)
      .map(([name, d]) => ({ name, kg: d.kg, pokok: d.pokok, pct: total > 0 ? (d.kg / total) * 100 : 0 }))
      .sort((a, b) => b.kg - a.kg);
  }, [kebun, latestLawatan]);

  // Monthly forecast
  const monthlyForecast = useMemo(() => {
    // Peta kebun untuk pulihkan negeri daripada profil kebun terkini
    const kebunMap: Record<string, KebunRecord> = {};
    const kebunByNama: Record<string, KebunRecord> = {};
    kebun.forEach(k => {
      kebunMap[k.id] = k;
      if (k.nama) kebunByNama[k.nama.trim().toLowerCase()] = k;
    });

    // Pulihkan negeri bagi satu rekod lawatan daripada pelbagai sumber (berlapis)
    const resolveNegeri = (l: LawatanRecord): string => {
      // 1) Padan profil kebun ikut kebunId, atau ikut nama kebun jika id tak padan
      const dariKebun = (l.kebunId && kebunMap[l.kebunId])
        || (l.kebunNama && kebunByNama[l.kebunNama.trim().toLowerCase()])
        || undefined;
      return (l.negeri && l.negeri.trim())
        || (dariKebun?.negeri && dariKebun.negeri.trim())
        || negeriDariDaerah(l.daerah)
        || negeriDariDaerah(dariKebun?.daerah)
        || negeriDariDaerah(l.pegawaiDaerah)
        || 'Negeri Tidak Direkod';
    };

    const map: Record<string, { kg: number; negeri: Set<string>; negeriKg: Record<string, number>; sort: number }> = {};
    latestLawatan.forEach(l => {
      if (!l.tarikhLawatan) return;
      const d = new Date(l.tarikhLawatan); d.setDate(d.getDate() + 30);
      const key = d.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
      // Nilai susunan berdasarkan tahun & bulan sebenar
      const sortVal = d.getFullYear() * 12 + d.getMonth();
      if (!map[key]) map[key] = { kg: 0, negeri: new Set(), negeriKg: {}, sort: sortVal };
      const nama = resolveNegeri(l);
      map[key].kg += l.totalKg || 0;
      map[key].negeri.add(nama);
      map[key].negeriKg[nama] = (map[key].negeriKg[nama] || 0) + (l.totalKg || 0);
    });
    return Object.entries(map)
      .map(([bulan, d]) => ({
        bulan,
        kg: d.kg,
        sort: d.sort,
        negeriCount: d.negeri.size,
        // Senarai negeri disusun mengikut sumbangan kg tertinggi
        negeriList: Object.entries(d.negeriKg).sort((a, b) => b[1] - a[1]).map(([nama, kg]) => ({ nama, kg })),
      }))
      // Susun bulan ikut turutan tarikh (awal ke akhir)
      .sort((a, b) => a.sort - b.sort);
  }, [latestLawatan, kebun]);
  const maxMonthKg = Math.max(...monthlyForecast.map(m => m.kg), 1);

  // Lambakan detection
  const lambakanAlerts = useMemo(() => {
    return monthlyForecast
      .filter(m => m.negeriCount >= 3 || m.kg >= 5000)
      .map(m => ({
        ...m,
        level: m.kg >= 10000 || m.negeriCount >= 5 ? 'KRITIKAL' : m.kg >= 5000 || m.negeriCount >= 4 ? 'TINGGI' : 'SEDERHANA',
      }));
  }, [monthlyForecast]);

  // Enjin cadangan intervensi FAMA — berasaskan data sebenar (tahap risiko, MT, negeri, varieti).
  // Menghasilkan cadangan berpadanan: padanan perniagaan/pemborong, pembelian intervensi,
  // pemprosesan, program jualan terus, eksport, dan koordinasi logistik.
  const cadanganIntervensi = useMemo(() => {
    if (lambakanAlerts.length === 0) return [];

    const puncak = lambakanAlerts.reduce((a, b) => (b.kg > a.kg ? b : a), lambakanAlerts[0]);
    const level = puncak.level;
    const puncakMT = puncak.kg / 1000;
    const negeriUtama = puncak.negeriList[0]?.nama || '';
    const varietiUtama = varietiDist[0]?.name || '';
    const senarai: { ikon: string; teks: string }[] = [];

    if (level === 'KRITIKAL') {
      // Lambakan besar & merentas banyak negeri — perlu pelbagai saluran serentak
      senarai.push({ ikon: '🏭', teks: 'Aktifkan Pembelian Intervensi & alihkan lebihan hasil ke fasiliti pemprosesan (puri, beku, pes durian) untuk lanjutkan jangka hayat produk.' });
      senarai.push({ ikon: '🤝', teks: `Laksanakan padanan perniagaan segera dengan pemborong besar${negeriUtama ? ` bagi menyerap hasil dari ${negeriUtama}` : ''}.` });
      senarai.push({ ikon: '🌏', teks: `Hubungi pembeli eksport untuk ${varietiUtama || 'varieti premium'} bagi kurangkan tekanan pasaran tempatan.` });
      senarai.push({ ikon: '🚚', teks: 'Koordinasi logistik antara negeri & pusat pengumpulan supaya agihan lebih sekata.' });
    } else if (level === 'TINGGI') {
      senarai.push({ ikon: '🤝', teks: `Utamakan padanan perniagaan melalui pemborong${negeriUtama ? ` di ${negeriUtama}` : ''} sebelum lebihan meningkat.` });
      senarai.push({ ikon: '🛒', teks: 'Anjurkan Program Jualan Terus (pasar tani/jualan komuniti) untuk menyerap hasil di peringkat tempatan.' });
      senarai.push({ ikon: '🏭', teks: 'Sediakan pilihan pemprosesan sebagai penampan jika permintaan segar tidak mencukupi.' });
    } else {
      // SEDERHANA — masih boleh diurus melalui saluran biasa
      senarai.push({ ikon: '🛒', teks: 'Galakkan Program Jualan Terus dan promosi tempatan untuk mengekalkan aliran jualan.' });
      senarai.push({ ikon: '📊', teks: 'Pantau unjuran mingguan; sedia laksanakan padanan pemborong jika hasil meningkat.' });
    }

    // Nota kuantiti untuk konteks keputusan
    senarai.push({ ikon: '📦', teks: `Anggaran ${puncakMT.toFixed(0)} MT dijangka pada ${puncak.bulan} — rancang kapasiti serapan awal.` });
    return senarai;
  }, [lambakanAlerts, varietiDist]);

  const today = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  if (authLoading || !canViewNationalDashboard) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <p className="text-sm text-gray-400">Menyemak akses Dashboard HQ...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* BI Header */}
      <div className="bg-gradient-forest rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{t('dash.title')}</h2>
              <p className="text-white/50 text-[10px]">{t('dash.subtitle')}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40">{t('dash.updated')}</p>
              <p className="text-[10px] text-white/70 font-medium">{today}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">{t('dash.kebun')}</p>
          <p className="text-2xl font-bold text-forest mt-1">{kpi.totalKebun}</p>
          <p className="text-[9px] text-moss mt-0.5">{kpi.negeriAktif} {t('dash.negeriAktif')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">{t('dash.keluasan')}</p>
          <p className="text-2xl font-bold text-forest mt-1">{kpi.totalEkar.toFixed(0)}</p>
          <p className="text-[9px] text-moss mt-0.5">{t('dash.ekarKeseluruhan')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">{t('dash.anggaranHasil')}</p>
          <p className="text-2xl font-bold text-gold mt-1">{kpi.totalMT.toFixed(2)}</p>
          <p className="text-[9px] text-moss mt-0.5">{t('dash.metrikTan')}</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">{t('dash.rekodLawatan')}</p>
          <p className="text-2xl font-bold text-forest mt-1">{kpi.totalLawatan}</p>
          <p className="text-[9px] text-moss mt-0.5">{t('dash.entryDirekod')}</p>
        </div>
      </div>

      {/* 1. Jadual Ringkasan Negeri */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-forest">{t('dash.jadualNegeri')}</h3>
          <span className="text-[9px] text-gray-400">{negeriRanking.length} negeri</span>
        </div>
        {negeriRanking.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Belum ada data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b-2 border-forest/20">
                  <th className="py-2 text-left font-bold text-forest">Bil.</th>
                  <th className="py-2 text-left font-bold text-forest">Negeri</th>
                  <th className="py-2 text-right font-bold text-forest">Kebun</th>
                  <th className="py-2 text-right font-bold text-forest">Ekar</th>
                  <th className="py-2 text-right font-bold text-forest">Pokok</th>
                  <th className="py-2 text-right font-bold text-forest">Hasil (MT)</th>
                </tr>
              </thead>
              <tbody>
                {negeriRanking.map((n, i) => (
                  <tr key={n.negeri} className={`border-b border-gray-100 ${i === 0 ? 'bg-gold/5' : ''}`}>
                    <td className="py-2 font-semibold text-gray-400">{i + 1}</td>
                    <td className="py-2 font-medium">
                      <span className="flex items-center gap-1.5">
                        {NEGERI_FLAG[n.negeri] ? (
                          <img src={NEGERI_FLAG[n.negeri]} alt="" className="w-5 h-3.5 object-contain rounded-sm flex-shrink-0" />
                        ) : NEGERI_FLAG_COLORS[n.negeri] ? (
                          <span className="inline-block w-5 h-3.5 rounded-sm border border-gray-200 overflow-hidden flex-shrink-0">
                            <span className="block w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].top }} />
                            <span className="block w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].bottom }} />
                          </span>
                        ) : null}
                        {n.negeri}
                      </span>
                    </td>
                    <td className="py-2 text-right">{n.kebun}</td>
                    <td className="py-2 text-right">{n.ekar.toFixed(1)}</td>
                    <td className="py-2 text-right">{n.pokok.toLocaleString()}</td>
                    <td className="py-2 text-right font-bold text-forest">{(n.kg / 1000).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-forest/20 font-bold">
                  <td className="py-2" colSpan={2}>JUMLAH</td>
                  <td className="py-2 text-right">{kpi.totalKebun}</td>
                  <td className="py-2 text-right">{kpi.totalEkar.toFixed(1)}</td>
                  <td className="py-2 text-right">{kpi.totalPokok.toLocaleString()}</td>
                  <td className="py-2 text-right text-forest">{kpi.totalMT.toFixed(3)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 2. Kategori Varieti */}
      <div className="grid grid-cols-1 gap-4">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-forest">{t('dash.varietiDist')}</h3>
            <span className="text-[9px] text-gray-400">{varietiDist.length} varieti</span>
          </div>
          {varietiDist.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Belum ada data</p>
          ) : (
            <div className="space-y-2.5">
              {varietiDist.slice(0, 6).map((v, i) => {
                const colors = ['bg-forest', 'bg-gold', 'bg-moss', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500'];
                const dotColors = ['bg-forest', 'bg-gold', 'bg-moss', 'bg-amber-500', 'bg-blue-500', 'bg-purple-500'];
                return (
                  <div key={v.name} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColors[i % dotColors.length]}`} />
                    <span className="text-[10px] text-gray-700 flex-1 truncate">{v.name}</span>
                    <span className="text-[9px] font-bold text-gray-600 w-10 text-right">{v.pct.toFixed(1)}%</span>
                    {/* Kawasan hover/klik — lebih besar (py-2) supaya senang dicapai */}
                    <div
                      className="relative w-16 py-2 cursor-pointer"
                      onMouseEnter={() => setActiveVarieti(v.name)}
                      onMouseLeave={() => setActiveVarieti(null)}
                      onClick={() => setActiveVarieti(prev => prev === v.name ? null : v.name)}
                    >
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${v.pct}%` }} />
                      </div>
                      {/* Pop-out — muncul bila cursor hover / klik pada bar */}
                      {activeVarieti === v.name && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30">
                          <div className="bg-forest text-white rounded-md shadow-lg px-2 py-1 whitespace-nowrap text-center">
                            <span className="text-[10px] font-bold block">{(v.kg / 1000).toFixed(2)} MT</span>
                            <span className="text-[8px] text-white/80 block">{v.pokok.toLocaleString()} pokok</span>
                          </div>
                          <div className="w-2 h-2 bg-forest rotate-45 absolute top-full left-1/2 -translate-x-1/2 -translate-y-1" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Jangkaan Pengeluaran Bulanan */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-forest">{t('dash.monthlyForecast')}</h3>
          <span className="text-[9px] text-gray-400">{t('dash.metrikTan')}</span>
        </div>
        {monthlyForecast.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Belum ada data</p>
        ) : (
          (() => {
            const totalKgAll = monthlyForecast.reduce((s, m) => s + m.kg, 0) || 1;
            const puncak = monthlyForecast.reduce((a, b) => (b.kg > a.kg ? b : a), monthlyForecast[0]);
            return (
              <div className="space-y-2.5">
                {monthlyForecast.map((m) => {
                  const width = Math.max((m.kg / maxMonthKg) * 100, 3);
                  const pct = (m.kg / totalKgAll) * 100;
                  const isPuncak = m.bulan === puncak.bulan;
                  return (
                    <div key={m.bulan} className="space-y-1">
                      {/* Baris atas: bulan + nilai MT */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[11px] font-semibold ${isPuncak ? 'text-forest' : 'text-gray-700'}`}>
                            {m.bulan}
                          </span>
                          {isPuncak && (
                            <span className="text-[7px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                              PUNCAK
                            </span>
                          )}
                          <span className="text-[8px] text-gray-400">{m.negeriCount} negeri</span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span className={`text-xs font-bold ${isPuncak ? 'text-forest' : 'text-gray-600'}`}>
                            {(m.kg / 1000).toFixed(1)}
                          </span>
                          <span className="text-[8px] text-gray-400">MT</span>
                        </div>
                      </div>
                      {/* Bar mendatar */}
                      <div className="flex items-center gap-2">
                        {/* Kawasan hover/klik pada bar — pop-out senarai negeri */}
                        <div
                          className="relative flex-1 py-1.5 cursor-pointer"
                          onMouseEnter={() => setActiveBulan(m.bulan)}
                          onMouseLeave={() => setActiveBulan(null)}
                          onClick={() => setActiveBulan(prev => prev === m.bulan ? null : m.bulan)}
                        >
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${isPuncak ? 'bg-forest' : 'bg-forest/40'}`}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                          {/* Pop-out: negeri mana mewakili data bulan ini */}
                          {activeBulan === m.bulan && (
                            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-30">
                              <div className="bg-forest text-white rounded-lg shadow-xl px-3 py-2 min-w-[140px]">
                                <p className="text-[9px] font-bold border-b border-white/20 pb-1 mb-1.5">
                                  {m.bulan}
                                </p>
                                <div className="space-y-1">
                                  {m.negeriList.map(n => (
                                    <div key={n.nama} className="flex items-center justify-between gap-3">
                                      <span className="text-[9px] text-white/90 whitespace-nowrap">{n.nama}</span>
                                      <span className="text-[9px] font-bold text-gold whitespace-nowrap">
                                        {(n.kg / 1000).toFixed(1)} MT
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="w-2 h-2 bg-forest rotate-45 absolute top-full left-1/2 -translate-x-1/2 -translate-y-1" />
                            </div>
                          )}
                        </div>
                        <span className="text-[8px] font-semibold text-gray-400 w-9 text-right">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  );
                })}
                {/* Ringkasan bawah */}
                <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100">
                  <span className="text-[9px] text-gray-500">Jumlah keseluruhan</span>
                  <span className="text-xs font-bold text-forest">{(totalKgAll / 1000).toFixed(1)} MT</span>
                </div>
              </div>
            );
          })()
        )}
      </div>

      {/* 4. Status Pengeluaran: Risiko Lambakan */}
      {lambakanAlerts.length > 0 && (
        <div className={`rounded-xl p-4 border ${
          lambakanAlerts[0].level === 'KRITIKAL' ? 'bg-red-50 border-red-200' :
          lambakanAlerts[0].level === 'TINGGI' ? 'bg-orange-50 border-orange-200' : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">
              {lambakanAlerts[0].level === 'KRITIKAL' ? '🔴' : lambakanAlerts[0].level === 'TINGGI' ? '🟠' : '🟡'}
            </span>
            <div className="flex-1">
              <p className={`text-sm font-bold ${
                lambakanAlerts[0].level === 'KRITIKAL' ? 'text-red-700' :
                lambakanAlerts[0].level === 'TINGGI' ? 'text-orange-700' : 'text-amber-700'
              }`}>
                Status Pengeluaran: Risiko Lambakan
              </p>
              <div className="mt-2 space-y-2">
                {lambakanAlerts.map((a, i) => (
                  <div key={i} className="text-[10px] text-gray-700">
                    <p>
                      <span className="font-semibold">{a.bulan}</span> — {(a.kg/1000).toFixed(2)} MT ({a.negeriCount} negeri)
                    </p>
                    {/* Perincian negeri yang berlaku lambakan — dengan bendera negeri */}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.negeriList.map((n) => (
                        <span key={n.nama} className="inline-flex items-center gap-1.5 text-[9px] bg-white border border-gray-200 rounded-full pl-1 pr-2 py-0.5 shadow-sm">
                          {NEGERI_FLAG[n.nama] ? (
                            <img src={NEGERI_FLAG[n.nama]} alt="" className="w-4 h-3 object-contain rounded-sm flex-shrink-0" />
                          ) : NEGERI_FLAG_COLORS[n.nama] ? (
                            <span className="inline-block w-4 h-3 rounded-sm border border-gray-200 overflow-hidden flex-shrink-0">
                              <span className="block w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.nama].top }} />
                              <span className="block w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.nama].bottom }} />
                            </span>
                          ) : (
                            <span className="inline-block w-4 h-3 rounded-sm bg-gray-200 flex-shrink-0" />
                          )}
                          <span className="text-gray-600">{n.nama}</span>
                          <span className="font-semibold text-forest">{(n.kg / 1000).toFixed(2)} MT</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-t border-gray-200/60 pt-2">
                <p className="text-[10px] font-bold text-gray-600 mb-1.5">💡 Cadangan Intervensi FAMA</p>
                <div className="space-y-1.5">
                  {cadanganIntervensi.map((c, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-[11px] leading-tight">{c.ikon}</span>
                      <p className="text-[9px] text-gray-600 leading-snug flex-1">{c.teks}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {lambakanAlerts.length === 0 && latestLawatan.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <span>🟢</span>
          <div>
            <p className="text-[10px] font-bold text-green-700">Status Pengeluaran: Terkawal</p>
            <p className="text-[9px] text-green-600">{t('dash.lambakanSafe')}</p>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Memuatkan data analisis...</p>
        </div>
      )}
    </div>
  );
}
