'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { collectionGroup, collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NEGERI_FLAG_COLORS, NEGERI_FLAG } from '@/lib/constants';
import toast from 'react-hot-toast';

interface KebunRecord {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
  saizKebun: number;
  jumlahPokok: number;
}

interface LawatanRecord {
  totalKg: number;
  tarikhLawatan: string;
  negeri: string;
  pegawaiDaerah: string;
}

interface NegeriData {
  negeri: string;
  daerah: string[];
  ekar: number;
  pokok: number;
  hasilMT: number;
  bulanPengeluaran: string;
}

export default function LaporanPage() {
  const { profile } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kebun, setKebun] = useState<KebunRecord[]>([]);
  const [lawatan, setLawatan] = useState<LawatanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'kebun'));
    const unsub = onSnapshot(q, (snap) => {
      setKebun(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collectionGroup(db, 'lawatan'));
    const unsub = onSnapshot(q, (snap) => {
      setLawatan(snap.docs.map(d => d.data() as LawatanRecord));
    });
    return () => unsub();
  }, []);

  // Aggregate by negeri
  const negeriData: NegeriData[] = (() => {
    const map: Record<string, { daerah: Set<string>; ekar: number; pokok: number; kg: number }> = {};
    kebun.forEach(k => {
      const n = k.negeri || 'Lain-lain';
      if (!map[n]) map[n] = { daerah: new Set(), ekar: 0, pokok: 0, kg: 0 };
      map[n].daerah.add(k.daerah || '');
      map[n].ekar += k.saizKebun || 0;
      map[n].pokok += k.jumlahPokok || 0;
    });
    lawatan.forEach(l => {
      const n = l.negeri || l.pegawaiDaerah || '';
      Object.keys(map).forEach(key => {
        if (key === n || n.includes(key)) map[key].kg += l.totalKg || 0;
      });
    });
    return Object.entries(map)
      .map(([negeri, d]) => ({
        negeri,
        daerah: Array.from(d.daerah).filter(Boolean),
        ekar: d.ekar,
        pokok: d.pokok,
        hasilMT: d.kg / 1000,
        bulanPengeluaran: 'Jun / Julai / Ogos',
      }))
      .sort((a, b) => b.hasilMT - a.hasilMT);
  })();

  const totalMT = negeriData.reduce((s, n) => s + n.hasilMT, 0);

  // Generate canvas report image
  const generateReport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 1080;
    const rowH = 95;
    const headerH = 200;
    const tableHeaderH = 50;
    const footerH = 80;
    const H = headerH + tableHeaderH + (negeriData.length * rowH) + footerH + 60;
    canvas.width = W;
    canvas.height = Math.max(H, 800);

    // Background
    ctx.fillStyle = '#0C2D1C';
    ctx.fillRect(0, 0, W, canvas.height);

    // Header
    ctx.fillStyle = '#124028';
    ctx.fillRect(0, 0, W, headerH);

    ctx.fillStyle = '#FFC107';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ANGGARAN KEBERHASILAN DURIAN', W / 2, 60);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '20px sans-serif';
    ctx.fillText('PERBANDINGAN PENGELUARAN ANTARA NEGERI & DAERAH', W / 2, 100);

    ctx.fillStyle = '#80CBC4';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Dijana: ${new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })} | ${profile?.nama || 'FAMA'}`, W / 2, 140);

    ctx.fillStyle = '#FFC107';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`JUMLAH KESELURUHAN: ${totalMT.toFixed(2)} METRIK TAN (MT)`, W / 2, 180);
    ctx.textAlign = 'start';

    // Table header
    let y = headerH + 10;
    ctx.fillStyle = '#1B5E20';
    ctx.fillRect(30, y, W - 60, tableHeaderH);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('NEGERI & DAERAH', 80, y + 30);
    ctx.textAlign = 'center';
    ctx.fillText('ANGGARAN (MT)', 720, y + 20);
    ctx.fillText('BERDASARKAN KELUASAN', 720, y + 38);
    ctx.fillText('JANGKAAN BULAN', 940, y + 20);
    ctx.fillText('PENGELUARAN', 940, y + 38);
    ctx.textAlign = 'start';

    y += tableHeaderH + 5;

    // Data rows
    negeriData.forEach((n, i) => {
      const rowY = y + (i * rowH);

      // Row background
      ctx.fillStyle = i % 2 === 0 ? '#F5F5F5' : '#FFFFFF';
      ctx.fillRect(30, rowY, W - 60, rowH - 5);

      // Flag color bar
      const flagColors = NEGERI_FLAG_COLORS[n.negeri];
      if (flagColors) {
        ctx.fillStyle = flagColors.bg;
        ctx.fillRect(30, rowY, 8, rowH - 5);
        // Mini flag
        ctx.fillStyle = flagColors.bg;
        ctx.fillRect(50, rowY + 15, 30, 20);
        ctx.fillStyle = flagColors.accent;
        ctx.fillRect(50, rowY + 35, 30, 20);
      }

      // Negeri name
      ctx.fillStyle = '#1F2937';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(n.negeri.toUpperCase(), 95, rowY + 32);

      // Daerah
      ctx.fillStyle = '#6B7280';
      ctx.font = '12px sans-serif';
      const daerahText = n.daerah.length > 0 ? `(${n.daerah.join('/')})` : '';
      ctx.fillText(daerahText.slice(0, 50), 95, rowY + 55);

      // Anggaran MT (big number)
      ctx.fillStyle = '#1F4D36';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(n.hasilMT > 0 ? n.hasilMT.toFixed(0).toLocaleString() : '-', 720, rowY + 45);

      // Bulan pengeluaran
      ctx.fillStyle = '#374151';
      ctx.font = '14px sans-serif';
      ctx.fillText(n.bulanPengeluaran, 940, rowY + 45);
      ctx.textAlign = 'start';
    });

    // Footer / Total row
    const totalY = y + (negeriData.length * rowH) + 10;
    ctx.fillStyle = '#FFC107';
    ctx.fillRect(30, totalY, W - 60, 50);

    ctx.fillStyle = '#0C2D1C';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('JUMLAH KESELURUHAN', 95, totalY + 32);

    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${totalMT.toFixed(0)}`, 720, totalY + 35);
    ctx.font = '12px sans-serif';
    ctx.fillText('METRIK TAN (MT)', 720, totalY + 48);
    ctx.textAlign = 'start';

    // Bottom footer
    ctx.fillStyle = '#80CBC4';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Hak Cipta Terpelihara © FAMA 2026 | Sistem Kalkulator Durian PWA', W / 2, canvas.height - 20);
    ctx.textAlign = 'start';

    // Generate image
    const dataUrl = canvas.toDataURL('image/png');
    setPreviewUrl(dataUrl);
    setShowPreview(true);
  };

  const downloadReport = () => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `Laporan_Durian_FAMA_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Laporan berjaya dimuat turun!');
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-forest">Laporan & Infografik</h2>
        <p className="text-xs text-gray-500">Jana laporan pengeluaran dengan bendera negeri</p>
      </div>

      {/* Ringkasan Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-xl font-bold text-forest">{negeriData.length}</p>
          <p className="text-[9px] text-gray-500">Negeri</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-xl font-bold text-forest">{kebun.length}</p>
          <p className="text-[9px] text-gray-500">Kebun</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 text-center">
          <p className="text-xl font-bold text-gold">{totalMT.toFixed(2)}</p>
          <p className="text-[9px] text-gray-500">Metrik Tan</p>
        </div>
      </div>

      {/* Negeri List with Flags */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-forest px-4 py-2.5">
          <div className="grid grid-cols-12 text-[9px] text-white font-bold">
            <div className="col-span-6">Negeri & Daerah</div>
            <div className="col-span-3 text-center">Anggaran (MT)</div>
            <div className="col-span-3 text-center">Bulan</div>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {negeriData.map((n, i) => {
            return (
              <div key={n.negeri} className={`grid grid-cols-12 items-center px-4 py-3 ${i === 0 ? 'bg-gold/5' : ''}`}>
                <div className="col-span-6 flex items-center gap-2">
                  {/* Flag */}
                  {NEGERI_FLAG[n.negeri] ? (
                    <img src={NEGERI_FLAG[n.negeri]} alt={n.negeri}
                      className="w-7 h-5 object-contain rounded-sm flex-shrink-0" />
                  ) : NEGERI_FLAG_COLORS[n.negeri] ? (
                    <div className="w-6 h-4 rounded-sm flex-shrink-0 border border-gray-200 overflow-hidden">
                      <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].top }} />
                      <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[n.negeri].bottom }} />
                    </div>
                  ) : null}
                  <div>
                    <p className="text-xs font-bold text-forest">{n.negeri}</p>
                    <p className="text-[8px] text-gray-400 truncate">{n.daerah.join(', ') || '-'}</p>
                  </div>
                </div>
                <div className="col-span-3 text-center">
                  <p className="text-sm font-bold text-forest">{n.hasilMT > 0 ? n.hasilMT.toFixed(0) : '-'}</p>
                </div>
                <div className="col-span-3 text-center">
                  <p className="text-[9px] text-gray-600">{n.bulanPengeluaran}</p>
                </div>
              </div>
            );
          })}
        </div>
        {/* Total */}
        <div className="bg-gold/20 px-4 py-3 grid grid-cols-12 items-center">
          <div className="col-span-6">
            <p className="text-xs font-bold text-forest">JUMLAH KESELURUHAN</p>
          </div>
          <div className="col-span-3 text-center">
            <p className="text-lg font-bold text-forest">{totalMT.toFixed(0)}</p>
            <p className="text-[8px] text-gray-500">Metrik Tan</p>
          </div>
          <div className="col-span-3 text-center">
            <span className="text-lg">🌱</span>
          </div>
        </div>
      </div>

      {/* Generate Button */}
      <button onClick={generateReport}
        className="w-full bg-gradient-gold text-black py-3.5 rounded-xl font-bold shadow-lg active:scale-[0.98] flex items-center justify-center gap-2">
        <span>📥</span> Jana Laporan Infografik
      </button>

      {/* Hidden canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-forest text-center mb-2">Laporan Berjaya Dijana!</h3>
            {previewUrl && <img src={previewUrl} alt="Laporan" className="w-full rounded-lg border border-gray-200 mb-4" />}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setShowPreview(false)} className="bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold text-sm">Tutup</button>
              <button onClick={downloadReport} className="bg-gradient-forest text-white py-3 rounded-xl font-semibold text-sm">💾 Muat Turun</button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-xs text-gray-400 text-center animate-pulse">Memuatkan data...</p>}
    </div>
  );
}
