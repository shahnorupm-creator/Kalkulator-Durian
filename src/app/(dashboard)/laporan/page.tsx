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

    // HQ "Semua Negeri" — show all negeri with daerah listing
    if (isHQ && filterNegeri === 'Semua') {
      // Compute per-negeri data with daerah
      const negeriMap: Record<string, { daerah: Set<string>; pekebun: number; ekar: number; kg: number; bulan: Set<number> }> = {};
      filtered.forEach(k => {
        const n = k.negeri || 'Lain-lain';
        if (!negeriMap[n]) negeriMap[n] = { daerah: new Set(), pekebun: 0, ekar: 0, kg: 0, bulan: new Set() };
        if (k.daerah) negeriMap[n].daerah.add(k.daerah);
        negeriMap[n].pekebun++;
        negeriMap[n].ekar += k.saizKebun || 0;
      });
      latestLawatan.forEach(r => {
        const farm = filteredById.get(r.kebunId);
        if (!farm) return;
        const n = farm.negeri || 'Lain-lain';
        if (!negeriMap[n]) return;
        negeriMap[n].kg += r.totalKg || 0;
        if (r.tarikhLawatan && r.stages) {
          const baseDate = new Date(`${r.tarikhLawatan}T00:00:00`);
          if (!Number.isNaN(baseDate.getTime())) {
            [{ key: 'mataketam', J: 120 }, { key: 'berbunga', J: 120 }, { key: 'putik', J: 90 }, { key: 'kecil', J: 60 }, { key: 'besar', J: 30 }].forEach(stage => {
              const input = r.stages?.[stage.key];
              if (!input || Number(input.pct) <= 0) return;
              const hDate = new Date(baseDate);
              hDate.setDate(hDate.getDate() + Math.max(0, stage.J - (Number(input.d) || 0)));
              negeriMap[n].bulan.add(hDate.getMonth());
            });
          }
        }
      });
      const BULAN_FULL = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
      const negeriRows = Object.entries(negeriMap).map(([negeri, d]) => ({
        negeri, daerah: Array.from(d.daerah).sort().join(' / '), pekebun: d.pekebun, ekar: d.ekar, kg: d.kg, mt: d.kg / 1000,
        bulan: d.bulan.size > 0 ? Array.from(d.bulan).sort((a, b) => a - b).map(m => BULAN_FULL[m]).join(' / ') : '-',
      })).sort((a, b) => b.mt - a.mt);

      const rowH = 65;
      const tableStartY = 180;
      const W = 1080;
      const H = Math.max(tableStartY + 45 + (negeriRows.length * rowH) + 80, 700);
      canvas.width = W; canvas.height = H;

      // Background white + header bar
      ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#1F4D36'; ctx.fillRect(0, 0, W, 110);

      // Title
      ctx.fillStyle = '#FFC107'; ctx.font = 'bold 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ANGGARAN KEBERHASILAN DURIAN', W / 2, 40);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 20px sans-serif';
      ctx.fillText('SELURUH MALAYSIA', W / 2, 70);
      ctx.fillStyle = '#80CBC4'; ctx.font = '13px sans-serif';
      ctx.fillText(`Dijana: ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })} | ${profile?.nama || 'FAMA'}`, W / 2, 95);

      // Summary stats
      const statsHQ = [
        { l: 'Bil. Negeri', v: String(negeriRows.length) },
        { l: 'Bil. Pekebun', v: String(totalPekebun) },
        { l: 'Jumlah Ekar', v: totalEkar.toFixed(1) },
        { l: 'Jumlah Pokok', v: totalPokok.toLocaleString() },
        { l: 'Anggaran (Mt)', v: totalMT.toFixed(2) },
      ];
      statsHQ.forEach((s, i) => {
        const x = 45 + i * 202;
        ctx.fillStyle = '#F0FDF4'; ctx.fillRect(x, 120, 190, 48);
        ctx.strokeStyle = '#1F4D36'; ctx.lineWidth = 1; ctx.strokeRect(x, 120, 190, 48);
        ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(s.v, x + 95, 145);
        ctx.fillStyle = '#6B7280'; ctx.font = '9px sans-serif';
        ctx.fillText(s.l, x + 95, 160);
      });

      // Table header
      ctx.textAlign = 'start';
      const colXHQ = [60, 350, 530, 680, 830, 950];
      const headersHQ = ['Negeri (Daerah)', 'Bil. Pekebun', 'Ekar', 'Kilogram (Kg)', 'Metrik Tan (Mt)', 'Bulan Pengeluaran'];
      ctx.fillStyle = '#1F4D36'; ctx.fillRect(50, tableStartY, W - 100, 35);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 11px sans-serif';
      headersHQ.forEach((h, i) => { ctx.textAlign = i > 0 ? 'center' : 'start'; ctx.fillText(h, colXHQ[i], tableStartY + 22); });

      // Table rows
      negeriRows.forEach((row, i) => {
        const y = tableStartY + 40 + (i * rowH);
        ctx.fillStyle = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'; ctx.fillRect(50, y, W - 100, rowH - 2);
        // Border bottom
        ctx.strokeStyle = '#E5E7EB'; ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(50, y + rowH - 2); ctx.lineTo(W - 50, y + rowH - 2); ctx.stroke();

        // Negeri name (bold)
        ctx.textAlign = 'start'; ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 13px sans-serif';
        ctx.fillText(row.negeri.toUpperCase(), colXHQ[0], y + 18);
        // Daerah (smaller, below — wrap to 2 lines if needed)
        ctx.fillStyle = '#C98A2C'; ctx.font = '10px sans-serif';
        const daerahParts = row.daerah.split(' / ');
        const maxPerLine = 4;
        const line1 = daerahParts.slice(0, maxPerLine).join(' / ');
        const line2 = daerahParts.length > maxPerLine ? daerahParts.slice(maxPerLine).join(' / ') : '';
        ctx.fillText(`(${line1})`, colXHQ[0], y + 34);
        if (line2) { ctx.fillText(`(${line2})`, colXHQ[0], y + 47); }

        // Data
        ctx.textAlign = 'center'; ctx.fillStyle = '#4B5563'; ctx.font = '12px sans-serif';
        ctx.fillText(String(row.pekebun), colXHQ[1], y + 28);
        ctx.fillText(row.ekar.toFixed(1), colXHQ[2], y + 28);
        ctx.fillStyle = '#C98A2C'; ctx.fillText(row.kg > 0 ? row.kg.toLocaleString() : '-', colXHQ[3], y + 28);
        ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 12px sans-serif';
        ctx.fillText(row.mt > 0 ? row.mt.toFixed(2) : '-', colXHQ[4], y + 28);
        // Bulan Pengeluaran — stack vertically if multiple
        ctx.fillStyle = '#6B7280'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
        const bulanParts = row.bulan.split(' / ');
        bulanParts.forEach((b, bi) => {
          ctx.fillText(b, colXHQ[5], y + 20 + (bi * 12));
        });
      });

      // Total row
      const totalYHQ = tableStartY + 40 + (negeriRows.length * rowH) + 5;
      ctx.fillStyle = '#FEF3C7'; ctx.fillRect(50, totalYHQ, W - 100, 35);
      ctx.strokeStyle = '#C98A2C'; ctx.lineWidth = 1; ctx.strokeRect(50, totalYHQ, W - 100, 35);
      ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'start'; ctx.fillText('JUMLAH KESELURUHAN', colXHQ[0], totalYHQ + 22);
      ctx.textAlign = 'center';
      ctx.fillText(String(totalPekebun), colXHQ[1], totalYHQ + 22);
      ctx.fillText(totalEkar.toFixed(1), colXHQ[2], totalYHQ + 22);
      ctx.fillStyle = '#C98A2C'; ctx.fillText(totalKg > 0 ? totalKg.toLocaleString() : '-', colXHQ[3], totalYHQ + 22);
      ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(totalMT.toFixed(2), colXHQ[4], totalYHQ + 22);

      // Footer
      ctx.fillStyle = '#9CA3AF'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('Hak Cipta Terpelihara © FAMA 2026 | Sistem Kalkulator Durian', W / 2, H - 15);

      setPreviewUrl(canvas.toDataURL('image/png'));
      setShowPreview(true);
      return; // Exit early — don't run the daerah-level report below
    }

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
    const BULAN_SHORT = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
    const daerahRows = Object.entries(daerahMap).map(([daerah, d]) => ({
      daerah, pekebun: d.pekebun.size, ekar: d.ekar, kg: d.kg, mt: d.kg / 1000,
      bulan: d.bulan.size > 0 ? Array.from(d.bulan).sort((a, b) => a - b).map(m => BULAN_SHORT[m]).join(' / ') : '-',
    })).sort((a, b) => b.mt - a.mt);

    const negeriName = isHQ ? (filterNegeri !== 'Semua' ? filterNegeri : 'Seluruh Malaysia') : userNegeri;

    // Varieti breakdown for this negeri (from saved kalkulator results)
    const varietiKgMap: Record<string, { kg: number; pokok: number }> = {};
    latestLawatan.forEach(r => {
      const farm = filteredById.get(r.kebunId);
      if (!farm) return;
      if (r.varietiResults) {
        r.varietiResults.forEach(v => {
          if (!varietiKgMap[v.name]) varietiKgMap[v.name] = { kg: 0, pokok: 0 };
          varietiKgMap[v.name].kg += v.kg || 0;
          varietiKgMap[v.name].pokok += v.pokok || 0;
        });
      }
    });
    const varietiReportRows = Object.entries(varietiKgMap)
      .map(([name, d]) => ({ name, kg: d.kg, pokok: d.pokok, mt: d.kg / 1000 }))
      .sort((a, b) => b.kg - a.kg);
    const allBulan = daerahRows.filter(d => d.bulan !== '-').map(d => d.bulan).join(' / ');
    const bulanNegeri = allBulan ? [...new Set(allBulan.split(' / '))].join(' / ') : '-';

    const rowH = 34;
    const daerahStartY = 250;
    const daerahTableH = 35 + (daerahRows.length * rowH) + 40;
    const varietiStartY = daerahStartY + daerahTableH + 40;
    const varietiTableH = varietiReportRows.length > 0 ? 35 + (varietiReportRows.length * rowH) + 40 : 0;
    const W = 1080;
    const H = Math.max(varietiStartY + varietiTableH + 90, 750);
    canvas.width = W; canvas.height = H;

    // Background — white
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, W, H);
    // Header bar
    ctx.fillStyle = '#1F4D36'; ctx.fillRect(0, 0, W, 120);

    // Title
    ctx.fillStyle = '#FFC107'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`ANGGARAN KEBERHASILAN DURIAN`, W / 2, 48);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`NEGERI ${negeriName.toUpperCase()}`, W / 2, 82);
    ctx.fillStyle = '#80CBC4'; ctx.font = '13px sans-serif';
    ctx.fillText(`Dijana: ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })} | ${profile?.nama || 'FAMA'}`, W / 2, 106);

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
      ctx.fillStyle = '#F0FDF4'; ctx.fillRect(x, 140, 190, 58);
      ctx.strokeStyle = '#1F4D36'; ctx.lineWidth = 1; ctx.strokeRect(x, 140, 190, 58);
      ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(s.v, x + 95, 172);
      ctx.fillStyle = '#6B7280'; ctx.font = '10px sans-serif';
      ctx.fillText(s.l, x + 95, 190);
    });

    // ═══ SECTION 1: Pecahan Mengikut Daerah ═══
    ctx.textAlign = 'start'; ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 15px sans-serif';
    ctx.fillText('📍 Pecahan Mengikut Daerah', 50, daerahStartY - 12);

    const colX = [60, 300, 450, 620, 780, 900];
    const headers = ['Daerah', 'Bil. Pekebun', 'Ekar', 'Kilogram (Kg)', 'Metrik Tan (Mt)', 'Bulan'];
    ctx.fillStyle = '#1F4D36'; ctx.fillRect(50, daerahStartY, W - 100, 35);
    ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 12px sans-serif';
    headers.forEach((h, i) => { ctx.textAlign = i > 0 ? 'center' : 'start'; ctx.fillText(h, colX[i], daerahStartY + 22); });

    daerahRows.forEach((row, i) => {
      const y = daerahStartY + 37 + (i * rowH);
      ctx.fillStyle = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'; ctx.fillRect(50, y, W - 100, rowH - 2);
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'start'; ctx.fillStyle = '#1F2937'; ctx.fillText(row.daerah, colX[0], y + 21);
      ctx.textAlign = 'center'; ctx.fillStyle = '#4B5563'; ctx.fillText(String(row.pekebun), colX[1], y + 21);
      ctx.fillText(row.ekar.toFixed(1), colX[2], y + 21);
      ctx.fillStyle = '#C98A2C'; ctx.fillText(row.kg > 0 ? row.kg.toLocaleString() : '-', colX[3], y + 21);
      ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#1F4D36'; ctx.fillText(row.mt > 0 ? row.mt.toFixed(2) : '-', colX[4], y + 21);
      ctx.font = '9px sans-serif'; ctx.fillStyle = '#6B7280';
      ctx.fillText(row.bulan.length > 16 ? row.bulan.substring(0, 16) + '..' : row.bulan, colX[5], y + 21);
    });

    // Daerah total row
    const daerahTotalY = daerahStartY + 37 + (daerahRows.length * rowH);
    ctx.fillStyle = '#FEF3C7'; ctx.fillRect(50, daerahTotalY, W - 100, 35);
    ctx.strokeStyle = '#C98A2C'; ctx.lineWidth = 1; ctx.strokeRect(50, daerahTotalY, W - 100, 35);
    ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'start'; ctx.fillText('JUMLAH', colX[0], daerahTotalY + 23);
    ctx.textAlign = 'center'; ctx.fillText(String(totalPekebun), colX[1], daerahTotalY + 23);
    ctx.fillText(totalEkar.toFixed(1), colX[2], daerahTotalY + 23);
    ctx.fillStyle = '#C98A2C'; ctx.fillText(totalKg > 0 ? totalKg.toLocaleString() : '-', colX[3], daerahTotalY + 23);
    ctx.fillStyle = '#1F4D36'; ctx.fillText(totalMT.toFixed(2), colX[4], daerahTotalY + 23);

    // ═══ SECTION 2: Pecahan Mengikut Varieti ═══
    if (varietiReportRows.length > 0) {
      ctx.textAlign = 'start'; ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 15px sans-serif';
      ctx.fillText('🌳 Pecahan Mengikut Varieti', 50, varietiStartY - 12);

      const vColX = [60, 500, 720, 920];
      const vHeaders = ['Varieti', 'Bil. Pokok', 'Kilogram (Kg)', 'Metrik Tan (Mt)'];
      ctx.fillStyle = '#1F4D36'; ctx.fillRect(50, varietiStartY, W - 100, 35);
      ctx.fillStyle = '#FFFFFF'; ctx.font = 'bold 12px sans-serif';
      vHeaders.forEach((h, i) => { ctx.textAlign = i > 0 ? 'center' : 'start'; ctx.fillText(h, vColX[i], varietiStartY + 22); });

      varietiReportRows.forEach((row, i) => {
        const y = varietiStartY + 37 + (i * rowH);
        ctx.fillStyle = i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'; ctx.fillRect(50, y, W - 100, rowH - 2);
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'start'; ctx.fillStyle = '#1F2937'; ctx.fillText(row.name, vColX[0], y + 21);
        ctx.textAlign = 'center'; ctx.fillStyle = '#4B5563'; ctx.fillText(row.pokok.toLocaleString(), vColX[1], y + 21);
        ctx.fillStyle = '#C98A2C'; ctx.fillText(`${row.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`, vColX[2], y + 21);
        ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = '#1F4D36'; ctx.fillText(`${row.mt.toFixed(2)} Mt`, vColX[3], y + 21);
      });

      // Varieti total row
      const vTotalY = varietiStartY + 37 + (varietiReportRows.length * rowH);
      const vTotalPokok = varietiReportRows.reduce((s, v) => s + v.pokok, 0);
      const vTotalKg = varietiReportRows.reduce((s, v) => s + v.kg, 0);
      ctx.fillStyle = '#FEF3C7'; ctx.fillRect(50, vTotalY, W - 100, 35);
      ctx.strokeStyle = '#C98A2C'; ctx.lineWidth = 1; ctx.strokeRect(50, vTotalY, W - 100, 35);
      ctx.fillStyle = '#1F4D36'; ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'start'; ctx.fillText('JUMLAH', vColX[0], vTotalY + 23);
      ctx.textAlign = 'center'; ctx.fillText(vTotalPokok.toLocaleString(), vColX[1], vTotalY + 23);
      ctx.fillStyle = '#C98A2C'; ctx.fillText(`${vTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg`, vColX[2], vTotalY + 23);
      ctx.fillStyle = '#1F4D36'; ctx.fillText(`${(vTotalKg / 1000).toFixed(2)} Mt`, vColX[3], vTotalY + 23);
    }

    // Bulan Pengeluaran banner
    const bulanY = H - 55;
    ctx.fillStyle = '#EFF6FF'; ctx.fillRect(50, bulanY, W - 100, 30);
    ctx.strokeStyle = '#3B82F6'; ctx.lineWidth = 1; ctx.strokeRect(50, bulanY, W - 100, 30);
    ctx.fillStyle = '#1E40AF'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`Jangkaan Bulan Pengeluaran: ${bulanNegeri}`, W / 2, bulanY + 20);

    // Footer
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Hak Cipta Terpelihara © FAMA 2026 | Sistem Kalkulator Durian', W / 2, H - 12);

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
    <div className="min-h-0 flex flex-col gap-3 lg:h-[calc(100vh-120px)] lg:overflow-hidden">
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
        {(isHQ || isAdminNegeri || userNegeri) && (
          <div className="flex gap-2 items-center flex-wrap">
            {/* Negeri filter — only for HQ/superadmin */}
            {isHQ && (
              <select value={filterNegeri} onChange={(e) => { setFilterNegeri(e.target.value); setFilterDaerah('Semua'); }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-white font-semibold text-forest focus:outline-none">
                <option value="Semua">🇲🇾 Semua Negeri</option>
                {negeriWithData.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            )}
            {/* Daerah filter — for admin negeri (always show) and HQ (when negeri selected) */}
            {(() => {
              const showDaerah = isAdminNegeri || !!userNegeri || (isHQ && filterNegeri !== 'Semua');
              const daerahList = (isAdminNegeri || (!isHQ && userNegeri))
                ? [...new Set(accessibleKebun.map(k => k.daerah).filter(Boolean))].sort()
                : daerahOptions;
              if (!showDaerah || daerahList.length === 0) return null;
              return (
                <select value={filterDaerah} onChange={(e) => setFilterDaerah(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-[10px] bg-white font-semibold text-forest focus:outline-none">
                  <option value="Semua">📍 Semua Daerah</option>
                  {daerahList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              );
            })()}
          </div>
        )}
      </div>



      {/* Main Content — scrollable */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">


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
                      <div className="grid grid-cols-4 bg-forest/10 px-3 py-1.5">
                        <span className="text-[8px] font-bold text-forest">Varieti / Anggaran Pengeluaran :</span>
                        <span className="text-[8px] font-bold text-forest text-right">Bil. Pokok</span>
                        <span className="text-[8px] font-bold text-forest text-right">Kilogram (Kg)</span>
                        <span className="text-[8px] font-bold text-forest text-right">Metrik Tan (Mt)</span>
                      </div>
                      {/* Table rows */}
                      {n.varietiKg.slice(0, 6).map(([name, kg], i) => {
                        const varietiPokok = varietiDist.find(v => v.name === name || v.name.split(' (')[0] === name.split(' (')[0])?.count || 0;
                        return (
                          <div key={name} className={`grid grid-cols-4 px-3 py-1.5 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <span className="text-[9px] text-gray-800 font-medium truncate">{name.split(' (')[0]}</span>
                            <span className="text-[9px] font-semibold text-forest text-right">{varietiPokok > 0 ? varietiPokok.toLocaleString() : '-'}</span>
                            <span className="text-[9px] font-bold text-gray-700 text-right">{kg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</span>
                            <span className="text-[9px] font-bold text-gold text-right">{(kg / 1000).toFixed(2)} Mt</span>
                          </div>
                        );
                      })}
                      {/* Total row */}
                      <div className="grid grid-cols-4 px-3 py-1.5 bg-forest/5 border-t border-forest/20">
                        <span className="text-[8px] font-bold text-forest">Jumlah</span>
                        <span className="text-[8px] font-bold text-forest text-right">{n.pokok.toLocaleString()}</span>
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
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 relative" onClick={(e) => e.stopPropagation()}>
            {/* Close X button */}
            <button onClick={() => setShowPreview(false)} className="absolute top-3 right-3 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold hover:bg-red-600 transition-all no-print">
              ✕
            </button>
            <h3 className="font-bold text-forest text-center mb-3 no-print">{t('report.generated')}</h3>
            {previewUrl && (
              <div className="print-content">
                <img src={previewUrl} alt="Laporan" className="w-full rounded-lg border border-gray-200 mb-4 print:border-0 print:rounded-none print:mb-0" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 no-print">
              <button onClick={downloadReport} className="bg-gradient-forest text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Muat Turun
              </button>
              <button onClick={() => window.print()} className="bg-white border-2 border-forest text-forest py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                🖨️ Cetak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
