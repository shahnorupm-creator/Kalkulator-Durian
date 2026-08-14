'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collectionGroup, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NEGERI_FLAG_COLORS, NEGERI_FLAG } from '@/lib/constants';

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
  fasa: string;
  fasaUtama: string;
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
}

export default function DashboardHQPage() {
  const { profile } = useAuth();
  const [lawatan, setLawatan] = useState<LawatanRecord[]>([]);
  const [kebun, setKebun] = useState<KebunRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collectionGroup(db, 'lawatan'));
    const unsub = onSnapshot(q, (snap) => {
      setLawatan(snap.docs.map(d => ({ id: d.id, ...d.data() } as LawatanRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'kebun'));
    const unsub = onSnapshot(q, (snap) => {
      setKebun(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
    });
    return () => unsub();
  }, []);

  // KPI Stats
  const kpi = useMemo(() => {
    const totalKebun = kebun.length;
    const totalEkar = kebun.reduce((s, k) => s + (k.saizKebun || 0), 0);
    const totalPokok = kebun.reduce((s, k) => s + (k.jumlahPokok || 0), 0);
    const totalKg = lawatan.reduce((s, l) => s + (l.totalKg || 0), 0);
    const totalMT = totalKg / 1000;
    const negeriAktif = new Set(kebun.map(k => k.negeri).filter(Boolean)).size;
    const totalLawatan = lawatan.length;
    return { totalKebun, totalEkar, totalPokok, totalKg, totalMT, negeriAktif, totalLawatan };
  }, [kebun, lawatan]);

  // Top negeri by ekar
  const negeriRanking = useMemo(() => {
    const map: Record<string, { kebun: number; ekar: number; pokok: number; kg: number }> = {};
    kebun.forEach(k => {
      const n = k.negeri || 'Lain-lain';
      if (!map[n]) map[n] = { kebun: 0, ekar: 0, pokok: 0, kg: 0 };
      map[n].kebun += 1;
      map[n].ekar += k.saizKebun || 0;
      map[n].pokok += k.jumlahPokok || 0;
    });
    lawatan.forEach(l => {
      const n = l.negeri || l.pegawaiDaerah || '';
      Object.keys(map).forEach(key => {
        if (key === n || n.includes(key)) map[key].kg += l.totalKg || 0;
      });
    });
    return Object.entries(map).map(([negeri, d]) => ({ negeri, ...d })).sort((a, b) => b.ekar - a.ekar);
  }, [kebun, lawatan]);

  // Varieti distribution
  const varietiDist = useMemo(() => {
    const map: Record<string, number> = {};
    lawatan.forEach(l => { const v = l.varieti || 'Lain'; map[v] = (map[v] || 0) + (l.totalKg || 0); });
    const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(map).map(([name, kg]) => ({ name, kg, pct: (kg / total) * 100 })).sort((a, b) => b.kg - a.kg);
  }, [lawatan]);

  // Monthly forecast
  const monthlyForecast = useMemo(() => {
    const map: Record<string, { kg: number; negeri: Set<string> }> = {};
    lawatan.forEach(l => {
      if (!l.tarikhLawatan) return;
      const d = new Date(l.tarikhLawatan); d.setDate(d.getDate() + 30);
      const key = d.toLocaleDateString('ms-MY', { month: 'short', year: '2-digit' });
      if (!map[key]) map[key] = { kg: 0, negeri: new Set() };
      map[key].kg += l.totalKg || 0;
      map[key].negeri.add(l.negeri || l.pegawaiDaerah || '');
    });
    return Object.entries(map).map(([bulan, d]) => ({ bulan, kg: d.kg, negeriCount: d.negeri.size }));
  }, [lawatan]);
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

  const today = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {/* BI Header */}
      <div className="bg-gradient-forest rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Executive Dashboard</h2>
              <p className="text-white/50 text-[10px]">Analisis Pengeluaran Durian FAMA</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40">Dikemas kini</p>
              <p className="text-[10px] text-white/70 font-medium">{today}</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">Jumlah Kebun</p>
          <p className="text-2xl font-bold text-forest mt-1">{kpi.totalKebun}</p>
          <p className="text-[9px] text-moss mt-0.5">{kpi.negeriAktif} negeri aktif</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">Keluasan</p>
          <p className="text-2xl font-bold text-forest mt-1">{kpi.totalEkar.toFixed(0)}</p>
          <p className="text-[9px] text-moss mt-0.5">ekar keseluruhan</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">Anggaran Hasil</p>
          <p className="text-2xl font-bold text-gold mt-1">{kpi.totalMT.toFixed(2)}</p>
          <p className="text-[9px] text-moss mt-0.5">metrik tan</p>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-[9px] text-gray-400 font-medium">Rekod Lawatan</p>
          <p className="text-2xl font-bold text-forest mt-1">{kpi.totalLawatan}</p>
          <p className="text-[9px] text-moss mt-0.5">entry direkodkan</p>
        </div>
      </div>

      {/* Lambakan Alert */}
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
                Amaran Lambakan: Risiko {lambakanAlerts[0].level}
              </p>
              <div className="mt-2 space-y-1">
                {lambakanAlerts.map((a, i) => (
                  <p key={i} className="text-[10px] text-gray-700">
                    <span className="font-semibold">{a.bulan}</span> — {(a.kg/1000).toFixed(2)} MT dari {a.negeriCount} negeri
                  </p>
                ))}
              </div>
              <p className="text-[9px] text-gray-500 mt-2">
                💡 Cadangan: {lambakanAlerts[0].level === 'KRITIKAL'
                  ? 'Sediakan logistik segera, aktifkan pusat pengumpulan & hubungi pembeli eksport.'
                  : 'Pantau perkembangan & koordinasi logistik dengan HQ.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {lambakanAlerts.length === 0 && lawatan.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
          <span>🟢</span>
          <p className="text-[10px] text-green-700 font-medium">Tiada risiko lambakan. Pengeluaran tersebar sekata.</p>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Negeri Ranking */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-forest">Pengeluaran Mengikut Negeri</h3>
            <span className="text-[9px] text-gray-400">{negeriRanking.length} negeri</span>
          </div>
          {negeriRanking.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-6">Belum ada data</p>
          ) : (
            <div className="space-y-2">
              {negeriRanking.slice(0, 8).map((n, i) => {
                const maxEkar = Math.max(...negeriRanking.map(x => x.ekar), 1);
                return (
                  <div key={n.negeri} className="flex items-center gap-2">
                    <span className={`text-[9px] w-4 text-center font-bold ${i < 3 ? 'text-gold' : 'text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] font-medium text-gray-700 flex items-center gap-1.5">
                          {NEGERI_FLAG[n.negeri] ? (
                            <img src={NEGERI_FLAG[n.negeri]} alt="" className="w-5 h-3.5 object-contain rounded-sm flex-shrink-0" />
                          ) : NEGERI_FLAG_COLORS[n.negeri] ? (
                            <span className="inline-block w-4 h-3 rounded-sm border border-gray-200 overflow-hidden flex-shrink-0">
                              <span className="block w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].top }} />
                              <span className="block w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].bottom }} />
                            </span>
                          ) : null}
                          {n.negeri}
                        </span>
                        <span className="text-[9px] text-forest font-bold">{n.ekar.toFixed(1)} ekar</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-forest' : i === 1 ? 'bg-moss' : 'bg-forest/40'}`}
                          style={{ width: `${(n.ekar / maxEkar) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-[8px] text-gray-400 w-10 text-right">{n.kebun} kbn</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Varieti Distribution */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-forest">Pecahan Varieti</h3>
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
                    <span className="text-[9px] font-bold text-gray-600">{v.pct.toFixed(1)}%</span>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors[i % colors.length]}`} style={{ width: `${v.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly Forecast Chart */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-forest">Jangkaan Pengeluaran Bulanan</h3>
          <span className="text-[9px] text-gray-400">metrik tan</span>
        </div>
        {monthlyForecast.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-6">Belum ada data</p>
        ) : (
          <div className="flex items-end gap-2 h-36 pt-4">
            {monthlyForecast.map((m, i) => {
              const height = Math.max((m.kg / maxMonthKg) * 100, 8);
              const isHighest = m.kg === maxMonthKg;
              return (
                <div key={m.bulan} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-[8px] font-bold ${isHighest ? 'text-forest' : 'text-gray-400'}`}>
                    {(m.kg / 1000).toFixed(1)}
                  </span>
                  <div className="w-full relative" style={{ height: '100px' }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-md transition-all duration-700 ${
                        isHighest ? 'bg-forest' : 'bg-forest/30'
                      }`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-[8px] text-gray-500 text-center">{m.bulan}</span>
                  <span className="text-[7px] text-gray-300">{m.negeriCount}n</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-forest">Jadual Ringkasan Negeri</h3>
        </div>
        {negeriRanking.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">Belum ada data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b-2 border-forest/20">
                  <th className="py-2 text-left font-bold text-forest">#</th>
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
                        {i === 0 ? '👑 ' : ''}{n.negeri}
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

      {/* Executive Summary Footer */}
      <div className="bg-gradient-forest rounded-xl p-5 text-white">
        <h3 className="text-sm font-bold mb-3">Ringkasan Eksekutif</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{kpi.totalMT.toFixed(1)}</p>
            <p className="text-[8px] text-white/50 mt-0.5">METRIK TAN</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{negeriRanking[0]?.negeri?.slice(0, 6) || '-'}</p>
            <p className="text-[8px] text-white/50 mt-0.5">NEGERI #1</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{kpi.totalPokok.toLocaleString()}</p>
            <p className="text-[8px] text-white/50 mt-0.5">POKOK</p>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{lambakanAlerts.length > 0 ? lambakanAlerts[0].level.slice(0, 4) : 'OK'}</p>
            <p className="text-[8px] text-white/50 mt-0.5">RISIKO</p>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-forest/30 border-t-forest rounded-full animate-spin mx-auto" />
          <p className="text-xs text-gray-400 mt-2">Memuatkan data analisis...</p>
        </div>
      )}
    </div>
  );
}
