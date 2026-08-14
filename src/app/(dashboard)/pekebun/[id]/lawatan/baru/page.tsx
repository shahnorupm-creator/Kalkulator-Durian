'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { VARIETIES, STAGES } from '@/lib/constants';
import toast from 'react-hot-toast';

interface StageInput {
  pct: number;
  d: number;
}

export default function LawatanBaruPage() {
  const params = useParams();
  const router = useRouter();
  const { user, profile } = useAuth();
  const pekebunId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [varieti, setVarieti] = useState<string>(VARIETIES[0].key);
  const [tarikhLawatan, setTarikhLawatan] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [saizKebun, setSaizKebun] = useState(1);
  const [kepadatan, setKepadatan] = useState(70);
  const [pctMatang, setPctMatang] = useState(90);
  const [hasilPerPokok, setHasilPerPokok] = useState<number>(VARIETIES[0].hasil);
  const [agroNote, setAgroNote] = useState<string>(VARIETIES[0].note);
  const [stages, setStages] = useState<Record<string, StageInput>>(
    Object.fromEntries(
      STAGES.map((s) => [s.key, { pct: s.defPct, d: s.defD ?? 0 }])
    )
  );
  const [showResults, setShowResults] = useState(false);

  // Auto-update when variety changes
  useEffect(() => {
    const v = VARIETIES.find((x) => x.key === varieti);
    if (v) {
      setHasilPerPokok(v.hasil);
      setAgroNote(v.note);
    }
  }, [varieti]);

  // Calculated values
  const jumlahPokok = useMemo(() => {
    return Math.round(saizKebun * kepadatan * (pctMatang / 100));
  }, [saizKebun, kepadatan, pctMatang]);

  const totalPct = useMemo(() => {
    return Object.values(stages).reduce((sum, s) => sum + s.pct, 0);
  }, [stages]);

  const results = useMemo(() => {
    return STAGES.map((stage) => {
      const input = stages[stage.key];
      if (stage.J === null) {
        return { ...stage, bakiHari: null, tarikhJangkaan: null, kg: 0 };
      }
      const bakiHari = stage.J - input.d;
      const kg = (input.pct / 100) * jumlahPokok * hasilPerPokok;
      const jangkaan = new Date(tarikhLawatan);
      jangkaan.setDate(jangkaan.getDate() + bakiHari);
      return {
        ...stage,
        pct: input.pct,
        bakiHari,
        tarikhJangkaan: input.pct > 0 ? jangkaan.toLocaleDateString('ms-MY', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) : null,
        kg,
      };
    });
  }, [stages, jumlahPokok, hasilPerPokok, tarikhLawatan]);

  const totalKg = useMemo(() => {
    return results.reduce((sum, r) => sum + r.kg, 0);
  }, [results]);

  const handleStageChange = (key: string, field: 'pct' | 'd', value: number) => {
    setStages((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  };

  const handleKira = () => {
    setShowResults(true);
  };

  const handleSubmit = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const selectedVariety = VARIETIES.find((v) => v.key === varieti);
      const lawatanData = {
        tarikhLawatan,
        varieti: selectedVariety?.name || varieti,
        varietiKey: varieti,
        saizKebun,
        kepadatan,
        pctMatang,
        jumlahPokok,
        hasilPerPokok,
        stages,
        totalKg,
        totalTan: totalKg / 1000,
        agroNote,
        pegawaiNama: profile?.nama || '',
        pegawaiNoPerkerja: profile?.noPerkerja || '',
        pegawaiDaerah: profile?.daerah || '',
        createdAt: serverTimestamp(),
      };

      await addDoc(
        collection(db, 'users', user.uid, 'pekebun', pekebunId, 'lawatan'),
        lawatanData
      );

      // Auto-sync to Google Sheet (fire-and-forget, don't block UX)
      fetch('/api/sync-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...lawatanData,
          createdAt: new Date().toISOString(),
        }),
      }).catch((err) => console.warn('Google Sheet sync failed:', err));

      toast.success('Rekod lawatan berjaya disimpan!');
      router.push(`/pekebun/${pekebunId}`);
    } catch (error) {
      console.error('Error saving lawatan:', error);
      toast.error('Gagal menyimpan. Sila cuba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="text-forest text-xl">
          ←
        </button>
        <h2 className="text-xl font-bold text-forest">Lawatan Baru</h2>
      </div>

      {/* Farm Info Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-forest">
        <h3 className="font-bold text-forest mb-3">Maklumat Lawatan</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Varieti Durian
            </label>
            <select
              value={varieti}
              onChange={(e) => setVarieti(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-forest focus:outline-none"
            >
              {VARIETIES.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Tarikh Lawatan
            </label>
            <input
              type="date"
              value={tarikhLawatan}
              onChange={(e) => setTarikhLawatan(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-forest focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Saiz Kebun (ekar)
              </label>
              <input
                type="number"
                value={saizKebun}
                onChange={(e) => setSaizKebun(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-forest focus:outline-none"
                min="0"
                step="0.1"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Kepadatan (pokok/ekar)
              </label>
              <input
                type="number"
                value={kepadatan}
                onChange={(e) => setKepadatan(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-forest focus:outline-none"
                min="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                % Pokok Matang & Berbuah
              </label>
              <input
                type="number"
                value={pctMatang}
                onChange={(e) => setPctMatang(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-forest focus:outline-none"
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Hasil / Pokok (kg)
              </label>
              <input
                type="number"
                value={hasilPerPokok}
                onChange={(e) => setHasilPerPokok(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-forest focus:outline-none"
                min="0"
                step="0.1"
              />
            </div>
          </div>

          {/* Auto-calculated */}
          <div className="bg-forest/5 rounded-lg p-3">
            <p className="text-xs text-gray-600">Jumlah Pokok Berbuah (auto)</p>
            <p className="text-lg font-bold text-forest">{jumlahPokok} pokok</p>
            <p className="text-[10px] text-gray-500 mt-1">
              {saizKebun} ekar × {kepadatan} pokok/ekar × {pctMatang}% matang
            </p>
          </div>
        </div>
      </div>

      {/* Growth Stages Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-gold">
        <h3 className="font-bold text-forest mb-3">Peringkat Pertumbuhan</h3>
        <p className="text-xs text-gray-500 mb-3">
          Masukkan % pokok & usia peringkat (hari) untuk setiap fasa
        </p>

        <div className="space-y-3">
          {STAGES.map((stage) => (
            <div
              key={stage.key}
              className="border-b border-gray-100 pb-3 last:border-0"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-forest">
                  {stage.name}
                </span>
                {stage.J && (
                  <span className="text-[10px] text-gray-400">
                    Kitaran: {stage.J} hari
                  </span>
                )}
              </div>
              {stage.J !== null ? (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">% Pokok</label>
                    <input
                      type="number"
                      value={stages[stage.key].pct}
                      onChange={(e) =>
                        handleStageChange(stage.key, 'pct', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-forest focus:outline-none"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">
                      Usia Peringkat (D)
                    </label>
                    <input
                      type="number"
                      value={stages[stage.key].d}
                      onChange={(e) =>
                        handleStageChange(stage.key, 'd', parseInt(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-forest focus:outline-none"
                      min="0"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-gray-500">% Pokok</label>
                  <input
                    type="number"
                    value={stages[stage.key].pct}
                    onChange={(e) =>
                      handleStageChange(stage.key, 'pct', parseFloat(e.target.value) || 0)
                    }
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-forest focus:outline-none"
                    min="0"
                    max="100"
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Tiada pengeluaran dijangka
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Percentage Total */}
        <div
          className={`mt-3 text-sm font-medium ${
            Math.abs(totalPct - 100) > 0.5 ? 'text-red-600' : 'text-moss'
          }`}
        >
          Jumlah: {totalPct.toFixed(2)}%
          {Math.abs(totalPct - 100) > 0.5 && ' (perlu ≈100%)'}
        </div>
      </div>

      {/* Agro Notes */}
      <div className="bg-white rounded-2xl p-5 shadow-sm">
        <h3 className="font-bold text-forest mb-2 text-sm">Catatan Agronomi</h3>
        <textarea
          value={agroNote}
          onChange={(e) => setAgroNote(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-forest focus:outline-none resize-none"
        />
        <button
          onClick={() => {
            const v = VARIETIES.find((x) => x.key === varieti);
            if (v) setAgroNote(v.note);
          }}
          className="text-xs text-gold mt-1 hover:underline"
        >
          ↺ Reset ke catatan rujukan varieti
        </button>
      </div>

      {/* Calculate Button */}
      <button
        onClick={handleKira}
        className="w-full bg-forest text-white py-3 rounded-xl font-semibold text-base shadow-md hover:bg-moss transition-colors"
      >
        Kira Anggaran
      </button>

      {/* Results */}
      {showResults && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-gold">
          <h3 className="font-bold text-forest mb-3">Keputusan Anggaran</h3>

          {Math.abs(totalPct - 100) > 0.5 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-xs text-yellow-800">
              Jumlah peratusan ialah {totalPct.toFixed(2)}%, bukan 100%.
              Anggaran tetap dikira tapi sila semak pecahan.
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-forest text-white">
                  <th className="px-2 py-2 text-left">Peringkat</th>
                  <th className="px-2 py-2 text-right">%</th>
                  <th className="px-2 py-2 text-right">Baki</th>
                  <th className="px-2 py-2 text-right">kg</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.key} className="border-b border-gray-100">
                    <td className="px-2 py-2 font-medium">{r.name}</td>
                    <td className="px-2 py-2 text-right">
                      {stages[r.key].pct.toFixed(1)}%
                    </td>
                    <td className="px-2 py-2 text-right text-gray-500">
                      {r.bakiHari !== null
                        ? stages[r.key].pct > 0
                          ? `${r.bakiHari}d`
                          : '-'
                        : '-'}
                    </td>
                    <td className="px-2 py-2 text-right font-semibold">
                      {r.kg > 0 ? r.kg.toFixed(1) : '-'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gold/10 font-bold">
                  <td className="px-2 py-2">Jumlah</td>
                  <td className="px-2 py-2 text-right">{totalPct.toFixed(1)}%</td>
                  <td className="px-2 py-2"></td>
                  <td className="px-2 py-2 text-right text-forest">
                    {totalKg.toFixed(1)} kg
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 bg-forest/5 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-600">Anggaran Keseluruhan</p>
            <p className="text-2xl font-bold text-forest">
              {totalKg.toFixed(2)} kg
            </p>
            <p className="text-sm text-moss">
              ({(totalKg / 1000).toFixed(3)} metrik tan)
            </p>
          </div>

          {/* Detail jangkaan tarikh */}
          <div className="mt-3 space-y-1">
            {results
              .filter((r) => r.tarikhJangkaan && stages[r.key].pct > 0)
              .map((r) => (
                <p key={r.key} className="text-[11px] text-gray-600">
                  <span className="font-medium">{r.name}:</span> Jangkaan matang{' '}
                  {r.tarikhJangkaan}
                </p>
              ))}
          </div>

          {/* Save Button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full mt-4 bg-gold text-white py-3 rounded-xl font-semibold shadow-md hover:bg-gold/80 transition-colors disabled:opacity-50"
          >
            {loading ? 'Menyimpan...' : '💾 Simpan Rekod Lawatan'}
          </button>
        </div>
      )}

      {/* Formula footnote */}
      <div className="text-[10px] text-gray-400 text-center px-2">
        Formula: Jumlah Pokok = Saiz × Kepadatan × %Matang | Baki = J − D |
        Anggaran = %Peringkat × Pokok × Hasil/Pokok
      </div>
    </div>
  );
}
