'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { collectionGroup, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VARIETIES, NEGERI_FLAG_COLORS, NEGERI_FLAG, STAGES, SENARAI_NEGERI, NEGERI_DAERAH } from '@/lib/constants';
import toast from 'react-hot-toast';

interface KebunRecord {
  id: string; nama: string; negeri: string; daerah: string;
  saizKebun: number; jumlahPokok: number;
  varietiData?: { usia: string; varieti: string; bilangan: number }[];
  varieti5_9: string; usia5_9: number;
  varieti10_15: string; usia10_15: number;
  varieti16_19: string; usia16_19: number;
  varieti20: string; usia20: number;
}

interface LawatanRecord {
  id: string; kebunId: string; totalKg: number; tarikhLawatan: string;
  negeri: string; daerah?: string;
  stages?: Record<string, { pct: number; d: number }>;
  varietiResults?: { key: string; name: string; pokok: number; kg: number }[];
  createdAt?: { seconds: number } | null;
}

export default function LaporanPage() {
  const { profile, isSuperAdmin } = useAuth();
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kebun, setKebun] = useState<KebunRecord[]>([]);
  const [lawatan, setLawatan] = useState<LawatanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [filterNegeri, setFilterNegeri] = useState('Semua');
  const [filterDaerah, setFilterDaerah] = useState('Semua');

  const isHQ = isSuperAdmin || profile?.role === 'admin_hq';
  const isAdminNegeri = profile?.role === 'admin_negeri';
  const userNegeri = profile?.negeri || '';

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'kebun')), (snap) => {
      setKebun(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collectionGroup(db, 'lawatan')), (snap) => {
      setLawatan(snap.docs.map(d => {
        const data = d.data() as Omit<LawatanRecord, 'id' | 'kebunId'> & { kebunId?: string };
        return { ...data, id: d.id, kebunId: data.kebunId || d.ref.parent.parent?.id || '' } as LawatanRecord;
      }));
    });
    return () => unsub();
  }, []);

  // Scope access
  const accessibleKebun = isHQ ? kebun : kebun.filter(k => k.negeri === userNegeri);

  // Apply filters
  const filtered = accessibleKebun.filter(k => {
    if (filterNegeri !== 'Semua' && k.negeri !== filterNegeri) return false;
    if (filterDaerah !== 'Semua' && k.daerah !== filterDaerah) return false;
    return true;
  });
  const filteredById = new Map(filtered.map(k => [k.id, k]));

  // Latest lawatan per kebun
  const latestLawatan = (() => {
    const map = new Map<string, LawatanRecord>();
    lawatan.forEach(r => {
      if (!r.kebunId || !filteredById.has(r.kebunId)) return;
      const cur = map.get(r.kebunId);
      const rTime = r.createdAt?.seconds || Date.parse(r.tarikhLawatan || '') / 1000 || 0;
      const cTime = cur?.createdAt?.seconds || Date.parse(cur?.tarikhLawatan || '') / 1000 || 0;
      if (!cur || rTime >= cTime) map.set(r.kebunId, r);
    });
    return Array.from(map.values());
  })();

  // Summary stats
  const totalPekebun = filtered.length;
  const totalEkar = filtered.reduce((s, k) => s + (k.saizKebun || 0), 0);
  const totalPokok = filtered.reduce((s, k) => s + (k.jumlahPokok || 0), 0);
  const totalKg = latestLawatan.reduce((s, r) => s + (r.totalKg || 0), 0);
  const totalMT = totalKg / 1000;

  // Varieti breakdown
  const varietiDist = (() => {
    const map: Record<string, number> = {};
    filtered.forEach(k => {
      const hasValid = k.varietiData && k.varietiData.some(v => v.varieti && v.bilangan > 0);
      if (hasValid) {
        k.varietiData!.forEach(v => { if (v.varieti && v.bilangan > 0) map[v.varieti] = (map[v.varieti] || 0) + v.bilangan; });
      } else {
        if (k.varieti5_9 && (k.usia5_9 || 0) > 0) map[k.varieti5_9] = (map[k.varieti5_9] || 0) + k.usia5_9;
        if (k.varieti10_15 && (k.usia10_15 || 0) > 0) map[k.varieti10_15] = (map[k.varieti10_15] || 0) + k.usia10_15;
        if (k.varieti16_19 && (k.usia16_19 || 0) > 0) map[k.varieti16_19] = (map[k.varieti16_19] || 0) + k.usia16_19;
        if (k.varieti20 && (k.usia20 || 0) > 0) map[k.varieti20] = (map[k.varieti20] || 0) + k.usia20;
      }
    });
    return Object.entries(map).map(([key, count]) => ({
      key, name: VARIETIES.find(v => v.key === key)?.name || key, count,
    })).sort((a, b) => b.count - a.count);
  })();
  const totalVarietiPokok = varietiDist.reduce((s, v) => s + v.count, 0);

  // Negeri list with data
  const negeriWithData = [...new Set(accessibleKebun.map(k => k.negeri).filter(Boolean))].sort();
  const daerahOptions = filterNegeri !== 'Semua' ? (NEGERI_DAERAH[filterNegeri] || []) : [];

  // Per-negeri breakdown for table
  const negeriBreakdown = (() => {
    const map: Record<string, { pekebun: Set<string>; ekar: number; pokok: number; kg: number; varietiKg: Record<string, number>; bulan: Set<number> }> = {};
    filtered.forEach(k => {
      const n = k.negeri || 'Lain-lain';
      if (!map[n]) map[n] = { pekebun: new Set(), ekar: 0, pokok: 0, kg: 0, varietiKg: {}, bulan: new Set() };
      map[n].pekebun.add(k.id);
      map[n].ekar += k.saizKebun || 0;
      map[n].pokok += k.jumlahPokok || 0;
    });
    latestLawatan.forEach(r => {
      const farm = filteredById.get(r.kebunId);
      if (!farm) return;
      const n = farm.negeri || 'Lain-lain';
      if (!map[n]) return;
      map[n].kg += r.totalKg || 0;
      // Aggregate varieti from saved kalkulator results
      if (r.varietiResults) {
        r.varietiResults.forEach(v => {
          map[n].varietiKg[v.name] = (map[n].varietiKg[v.name] || 0) + (v.kg || 0);
        });
      }
      // Harvest months from stages
      if (r.tarikhLawatan && r.stages) {
        const baseDate = new Date(`${r.tarikhLawatan}T00:00:00`);
        if (!Number.isNaN(baseDate.getTime())) {
          const STAGES_DATA = [
            { key: 'mataketam', J: 120 }, { key: 'berbunga', J: 120 }, { key: 'putik', J: 90 },
            { key: 'kecil', J: 60 }, { key: 'besar', J: 30 },
          ];
          STAGES_DATA.forEach(stage => {
            const input = r.stages?.[stage.key];
            if (!input || Number(input.pct) <= 0) return;
            const harvestDate = new Date(baseDate);
            harvestDate.setDate(harvestDate.getDate() + Math.max(0, stage.J - (Number(input.d) || 0)));
            map[n].bulan.add(harvestDate.getMonth());
          });
        }
      }
    });
    const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
    return Object.entries(map).map(([negeri, d]) => ({
      negeri, pekebun: d.pekebun.size, ekar: d.ekar, pokok: d.pokok, kg: d.kg, mt: d.kg / 1000,
      varietiKg: Object.entries(d.varietiKg).sort((a, b) => b[1] - a[1]),
      bulanPengeluaran: d.bulan.size > 0 ? Array.from(d.bulan).sort((a, b) => a - b).map(m => BULAN[m]).join(' / ') : 'Belum direkodkan',
    })).sort((a, b) => b.mt - a.mt);
  })();

  const generateReport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Compute daerah breakdown for the infographic
    const daerahMap: Record<string, { pekebun: Set<string>; ekar: number; kg: number; bulan: Set<number> }> = {};
    filtered.forEach(k => {
      const d = k.daerah || 'Lain-lain';
      if (!daerahMap[d]) daerahMap[d] = { pekebun: new Set(), ekar: 0, kg: 0, bulan: new Set() };
      daerahMap[d].pekebun.add(k.id);
      daerahMap[d].ekar += k.saizKebun || 0;
    });
    latestLawatan.forEach(r => {
      const farm = filteredById.get(r.kebunId);
      if (!farm) return;
      const d = farm.daerah || 'Lain-lain';
      if (!daerahMap[d]) return;
      daerahMap[d].kg += r.totalKg || 0;
      if (r.tarikhLawatan && r.stages) {
        const baseDate = new Date(`${r.tarikhLawatan}T00:00:00`);
        if (!Number.isNaN(baseDate.getTime())) {
          [{ key: 'mataketam', J: 120 }, { key: 'berbunga', J: 120 }, { key: 'putik', J: 90 }, { key: 'kecil', J: 60 }, { key: 'besar', J: 30 }].forEach(stage => {
            const input = r.stages?.[stage.key];
            if (!input || Number(input.pct) <= 0) return;
            const hDate = new Date(baseDate);
            hDate.setDate(hDate.getDate() + Math.max(0, stage.J - (Number(input.d) || 0)));
            daerahMap[d].bulan.add(hDate.getMonth());
          });
        }
      }
    });
    const BULAN_SHORT = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
    const daerahRows = Object.entries(daerahMap).map(([daerah, d]) => ({
      daerah, pekebun: d.pekebun.size, ekar: d.ekar, kg: d.kg, mt: d.kg / 1000,
      bulan: d.bulan.size > 0 ? Array.from(d.bulan).sort((a, b) => a - b).map(m => BULAN_SHORT[m]).join(' / ') : '-',
    })).sort((a, b) => b.mt - a.mt);

    const negeriName = isHQ ? (filterNegeri !== 'Semua' ? filterNegeri : 'Seluruh Malaysia') : userNegeri;
    const rowH = 32;
    const tableStartY = 240;
    const W = 1080;
    const H = Math.max(tableStartY + 50 + (daerahRows.length * rowH) + 80, 700);
    canvas.width = W; canvas.height = H;

    // Background
    ctx.fillStyle = '#0C2D1C'; ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#FFC107'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`ANGGARAN KEBERHASILAN DURIAN`, W / 2, 45);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`NEGERI ${negeriName.toUpperCase()}`, W / 2, 78);
    ctx.fillStyle = '#80CBC4'; ctx.font = '14px sans-serif';
    ctx.fillText(`Dijana: ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })} | ${profile?.nama || 'FAMA'}`, W / 2, 105);

    // Stats boxes
    const statsData = [
      { l: 'Bil. Pekebun', v: String(totalPekebun) },
      { l: 'Bil. Daerah', v: String(daerahRows.length) },
      { l: 'Jumlah Ekar', v: totalEkar.toFixed(1) },
      { l: 'Jumlah Pokok', v: totalPokok.toLocaleString() },
      { l: 'Anggaran (Mt)', v: totalMT.toFixed(2) },
    ];
    statsData.forEach((s, i) => {
      const x = 45 + i * 202;
      ctx.fillStyle = '#1B5E20'; ctx.fillRect(x, 125, 190, 55);
      ctx.fillStyle = '#FFC107'; ctx.font = 'bold 20px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(s.v, x + 95, 155);
      ctx.fillStyle = '#80CBC4'; ctx.font = '10px sans-serif';
      ctx.fillText(s.l, x + 95, 172);
    });

    // Table header
    ctx.textAlign = 'start';
    const colX = [60, 280, 430, 600, 750, 880];
    const headers = ['Daerah', 'Bil. Pekebun', 'Ekar', 'Anggaran (Kg)', 'Metrik Tan (Mt)', 'Bulan Pengeluaran'];
    ctx.fillStyle = '#2E7D32'; ctx.fillRect(50, tableStartY - 5, W - 100, 35);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 12px sans-serif';
    headers.forEach((h, i) => { ctx.textAlign = i > 0 ? 'center' : 'start'; ctx.fillText(h, colX[i], tableStartY + 18); });

    // Table rows
    daerahRows.forEach((row, i) => {
      const y = tableStartY + 35 + (i * rowH);
      ctx.fillStyle = i % 2 === 0 ? '#102a1a' : '#0C2D1C'; ctx.fillRect(50, y, W - 100, rowH - 2);

      ctx.font = '12px sans-serif';
      ctx.textAlign = 'start'; ctx.fillStyle = '#FFFFFF'; ctx.fillText(row.daerah, colX[0], y + 20);
      ctx.textAlign = 'center'; ctx.fillStyle = '#80CBC4'; ctx.fillText(String(row.pekebun), colX[1], y + 20);
      ctx.fillText(row.ekar.toFixed(1), colX[2], y + 20);
      ctx.fillStyle = '#FFC107'; ctx.fillText(row.kg > 0 ? row.kg.toLocaleString() : '-', colX[3], y + 20);
      ctx.font = 'bold 12px sans-serif'; ctx.fillText(row.mt > 0 ? row.mt.toFixed(2) : '-', colX[4], y + 20);
      ctx.font = '11px sans-serif'; ctx.fillStyle = '#80CBC4'; ctx.fillText(row.bulan, colX[5], y + 20);
    });

    // Total row
    const totalY = tableStartY + 35 + (daerahRows.length * rowH) + 5;
    ctx.fillStyle = '#FFC107'; ctx.fillRect(50, totalY, W - 100, 35);
    ctx.fillStyle = '#0C2D1C'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'start'; ctx.fillText('JUMLAH', colX[0], totalY + 22);
    ctx.textAlign = 'center'; ctx.fillText(String(totalPekebun), colX[1], totalY + 22);
    ctx.fillText(totalEkar.toFixed(1), colX[2], totalY + 22);
    ctx.fillText(totalKg > 0 ? totalKg.toLocaleString() : '-', colX[3], totalY + 22);
    ctx.fillText(totalMT.toFixed(2), colX[4], totalY + 22);

    // Footer
    ctx.fillStyle = '#80CBC4'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Hak Cipta Terpelihara © FAMA 2026 | Sistem Kalkulator Durian', W / 2, H - 15);

    setPreviewUrl(canvas.toDataURL('image/png'));
    setShowPreview(true);
  };

  const downloadReport = () => {
    if (!previewUrl) return;
    const a = document.createElement('a'); a.href = previewUrl;
    a.download = `Laporan_Durian_${Date.now()}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success(t('report.downloaded'));
  };

  if (loading) return <div className="flex items-center justify-center h-[60vh]"><p className="text-sm text-gray-400 animate-pulse">Memuatkan data...</p></div>;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-3 overflow-hidden">
      {/* Header + Filters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-forest">
              {t('report.title')} {!isHQ && userNegeri ? `— ${userNegeri}` : ''}
            </h2>
            <p className="text-[9px] text-gray-500">
              {isHQ ? (filterNegeri !== 'Semua' ? filterNegeri : 'Seluruh Malaysia') : userNegeri}
              {filterDaerah !== 'Semua' && ` • ${filterDaerah}`}
            </p>
          </div>
          <button onClick={generateReport}
            className="bg-gradient-gold text-black px-3 py-2 rounded-xl text-[10px] font-bold shadow-md active:scale-[0.98]">
            📥 Jana Infografik
          </button>
        </div>

        {/* Filters — HQ/superadmin can filter negeri */}
        {(isHQ || isAdminNegeri) && (
          <div className="flex gap-2 items-center flex-wrap">
            <select value={filterNegeri} onChange={(e) => { setFilterNegeri(e.target.value); setFilterDaerah('Semua'); }}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-white font-semibold text-forest focus:outline-none">
              <option value="Semua">🇲🇾 Semua Negeri</option>
              {negeriWithData.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            {filterNegeri !== 'Semua' && daerahOptions.length > 0 && (
              <select value={filterDaerah} onChange={(e) => setFilterDaerah(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-white font-semibold text-forest focus:outline-none">
                <option value="Semua">Semua Daerah</option>
                {daerahOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-forest/5 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-forest">{totalPekebun}</p>
          <p className="text-[8px] text-gray-500">Pekebun</p>
        </div>
        <div className="bg-forest/5 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-forest">{totalEkar.toFixed(1)}</p>
          <p className="text-[8px] text-gray-500">Ekar</p>
        </div>
        <div className="bg-forest/5 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-forest">{totalPokok.toLocaleString()}</p>
          <p className="text-[8px] text-gray-500">Pokok</p>
        </div>
        <div className="bg-gold/10 rounded-xl p-2.5 text-center">
          <p className="text-lg font-bold text-gold">{totalMT.toFixed(1)}</p>
          <p className="text-[8px] text-gray-500">Anggaran Mt</p>
        </div>
      </div>

      {/* Main Content — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {/* Varieti Distribution */}
        {varietiDist.length > 0 && (
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 mb-2">Pecahan Varieti</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              {varietiDist.map(v => {
                const pct = totalVarietiPokok > 0 ? ((v.count / totalVarietiPokok) * 100) : 0;
                return (
                  <div key={v.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] text-gray-700 truncate">{v.name.split(' (')[0]}</p>
                      <div className="w-full h-1 bg-gray-200 rounded-full mt-0.5">
                        <div className="h-full bg-forest/60 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <span className="text-[9px] font-bold text-forest flex-shrink-0">{v.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Kad Detail Negeri */}
        {negeriBreakdown.length > 0 && (
          <div className="space-y-3">
            {negeriBreakdown.map(n => (
              <div key={n.negeri} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Card Header */}
                <div className="bg-forest px-3 py-2 flex items-center gap-2">
                  {NEGERI_FLAG[n.negeri] ? (
                    <img src={NEGERI_FLAG[n.negeri]} alt={n.negeri} className="w-7 h-5 object-contain rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : NEGERI_FLAG_COLORS[n.negeri] ? (
                    <div className="w-6 h-4 rounded-sm border border-white/30 overflow-hidden flex-shrink-0">
                      <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].top }} />
                      <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].bottom }} />
                    </div>
                  ) : null}
                  <p className="text-xs font-bold text-white">{n.negeri}</p>
                </div>
                {/* Card Body */}
                <div className="p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-forest/5 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[8px] text-gray-500">Bil. Pekebun</p>
                      <p className="text-sm font-bold text-forest">{n.pekebun}</p>
                    </div>
                    <div className="bg-forest/5 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[8px] text-gray-500">Keluasan</p>
                      <p className="text-sm font-bold text-forest">{n.ekar.toFixed(1)} <span className="text-[7px] font-normal">ekar</span></p>
                    </div>
                    <div className="bg-forest/5 rounded-lg px-2 py-1.5 text-center">
                      <p className="text-[8px] text-gray-500">Bil. Pokok</p>
                      <p className="text-sm font-bold text-forest">{n.pokok.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gold/10 rounded-lg px-2 py-2 text-center">
                      <p className="text-[8px] text-gray-500">Kilogram (Kg)</p>
                      <p className="text-base font-bold text-gold">{n.kg > 0 ? `${n.kg.toLocaleString()}` : '-'}</p>
                    </div>
                    <div className="bg-gold/10 rounded-lg px-2 py-2 text-center">
                      <p className="text-[8px] text-gray-500">Metrik Tan (Mt)</p>
                      <p className="text-base font-bold text-gold">{n.mt > 0 ? n.mt.toFixed(2) : '-'}</p>
                    </div>
                  </div>
                  {/* Varieti Breakdown */}
                  {n.varietiKg.length > 0 && (
                    <div className="rounded-lg overflow-hidden border border-gray-100">
                      {/* Table header */}
                      <div className="grid grid-cols-3 bg-forest/10 px-3 py-1.5">
                        <span className="text-[8px] font-bold text-forest">Varieti / Anggaran Pengeluaran :</span>
                        <span className="text-[8px] font-bold text-forest text-right">Anggaran Hasil (Kg)</span>
                        <span className="text-[8px] font-bold text-forest text-right">Metrik Tan (Mt)</span>
                      </div>
                      {/* Table rows */}
                      {n.varietiKg.slice(0, 6).map(([name, kg], i) => (
                        <div key={name} className={`grid grid-cols-3 px-3 py-1.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <span className="text-[9px] text-gray-800 font-medium truncate">{name.split(' (')[0]}</span>
                          <span className="text-[9px] font-bold text-gray-700 text-right">{kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
                          <span className="text-[9px] font-bold text-gold text-right">{(kg / 1000).toFixed(2)} Mt</span>
                        </div>
                      ))}
                      {/* Total row */}
                      <div className="grid grid-cols-3 px-3 py-1.5 bg-forest/5 border-t border-forest/20">
                        <span className="text-[8px] font-bold text-forest">Jumlah</span>
                        <span className="text-[8px] font-bold text-forest text-right">{n.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
                        <span className="text-[8px] font-bold text-gold text-right">{n.mt.toFixed(2)} Mt</span>
                      </div>
                    </div>
                  )}
                  {/* Bulan Pengeluaran */}
                  <div className="bg-blue-50 rounded-lg px-2 py-1.5 text-center">
                    <p className="text-[8px] text-gray-500">Jangkaan Bulan Pengeluaran</p>
                    <p className="text-[10px] font-bold text-blue-700">{n.bulanPengeluaran}</p>
                  </div>
                </div>
              </div>
            ))}
            {/* Total card */}
            <div className="bg-gold/10 border border-gold/30 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-700">JUMLAH KESELURUHAN</span>
              <span className="text-lg font-bold text-forest">{totalMT.toFixed(2)} Mt</span>
            </div>
          </div>
        )}
      </div>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-forest text-center mb-2">{t('report.generated')}</h3>
            {previewUrl && <img src={previewUrl} alt="Laporan" className="w-full rounded-lg border border-gray-200 mb-4" />}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPreview(false)} className="bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm">{t('report.close')}</button>
              <button onClick={downloadReport} className="bg-gradient-forest text-white py-3 rounded-xl font-semibold text-sm">{t('report.download')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
