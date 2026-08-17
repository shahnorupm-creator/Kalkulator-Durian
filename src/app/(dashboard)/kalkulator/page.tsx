'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { collection, query, onSnapshot, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VARIETIES, STAGES, NEGERI_FLAG, NEGERI_FLAG_COLORS } from '@/lib/constants';
import toast from 'react-hot-toast';

interface KebunRecord {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
  saizKebun: number;
  kepadatan: number;
  pctMatang: number;
}

interface StageInput { pct: number; d: number; }

// Preset peratusan berdasarkan fasa utama yang dipilih
const FASA_PRESETS: Record<string, Record<string, { pct: number; d: number }>> = {
  mataketam: {
    mataketam: { pct: 70, d: 15 },
    berbunga: { pct: 10, d: 5 },
    putik: { pct: 0, d: 0 },
    kecil: { pct: 0, d: 0 },
    besar: { pct: 0, d: 0 },
    tidak: { pct: 20, d: 0 },
  },
  berbunga: {
    mataketam: { pct: 10, d: 25 },
    berbunga: { pct: 60, d: 15 },
    putik: { pct: 10, d: 5 },
    kecil: { pct: 0, d: 0 },
    besar: { pct: 0, d: 0 },
    tidak: { pct: 20, d: 0 },
  },
  putik: {
    mataketam: { pct: 0, d: 0 },
    berbunga: { pct: 10, d: 20 },
    putik: { pct: 60, d: 20 },
    kecil: { pct: 15, d: 10 },
    besar: { pct: 0, d: 0 },
    tidak: { pct: 15, d: 0 },
  },
  kecil: {
    mataketam: { pct: 0, d: 0 },
    berbunga: { pct: 0, d: 0 },
    putik: { pct: 10, d: 40 },
    kecil: { pct: 65, d: 30 },
    besar: { pct: 15, d: 5 },
    tidak: { pct: 10, d: 0 },
  },
  besar: {
    mataketam: { pct: 0, d: 0 },
    berbunga: { pct: 0, d: 0 },
    putik: { pct: 0, d: 0 },
    kecil: { pct: 22, d: 40 },
    besar: { pct: 73, d: 2 },
    tidak: { pct: 5, d: 0 },
  },
  tidak: {
    mataketam: { pct: 0, d: 0 },
    berbunga: { pct: 0, d: 0 },
    putik: { pct: 0, d: 0 },
    kecil: { pct: 0, d: 0 },
    besar: { pct: 0, d: 0 },
    tidak: { pct: 100, d: 0 },
  },
};

export default function KalkulatorPage() {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const [kebunList, setKebunList] = useState<KebunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKebun, setSelectedKebun] = useState<string>('');
  const [varieti, setVarieti] = useState<string>(VARIETIES[0].key);
  const [fasaUtama, setFasaUtama] = useState<string>('besar');
  const [tarikhLawatan, setTarikhLawatan] = useState(new Date().toISOString().split('T')[0]);
  const [stages, setStages] = useState<Record<string, StageInput>>(FASA_PRESETS['besar']);
  const [showResults, setShowResults] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch kebun list from centralized collection
  useEffect(() => {
    if (!user) return;
    // Pegawai nampak kebun assigned; superadmin / admin negeri / admin HQ nampak semua
    const isAdminUser =
      profile?.role === 'superadmin' ||
      profile?.role === 'admin_negeri' ||
      profile?.role === 'admin_hq';
    const q = isAdminUser
      ? query(collection(db, 'kebun'), orderBy('nama'))
      : query(collection(db, 'kebun'), where('assignedTo', '==', user.uid), orderBy('nama'));
    const unsub = onSnapshot(q, (snap) => {
      setKebunList(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile]);

  // Auto-populate stages when fasa changes
  const handleFasaChange = (newFasa: string) => {
    setFasaUtama(newFasa);
    setStages(FASA_PRESETS[newFasa] || FASA_PRESETS['besar']);
    setShowResults(false);
  };

  const kebun = kebunList.find(k => k.id === selectedKebun);
  const selectedVariety = VARIETIES.find(v => v.key === varieti);
  const hasilPerPokok = selectedVariety?.hasil || 150;

  const jumlahPokok = useMemo(() => {
    if (!kebun) return 0;
    return Math.round(kebun.saizKebun * kebun.kepadatan * (kebun.pctMatang / 100));
  }, [kebun]);

  const totalPct = useMemo(() => Object.values(stages).reduce((s, v) => s + v.pct, 0), [stages]);

  const results = useMemo(() => {
    return STAGES.map(stage => {
      const input = stages[stage.key];
      if (stage.J === null) return { ...stage, bakiHari: null, tarikh: null, kg: 0 };
      const bakiHari = stage.J - input.d;
      const kg = (input.pct / 100) * jumlahPokok * hasilPerPokok;
      const d = new Date(tarikhLawatan);
      d.setDate(d.getDate() + bakiHari);
      return {
        ...stage,
        bakiHari,
        tarikh: input.pct > 0 ? d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' }) : null,
        kg,
      };
    });
  }, [stages, jumlahPokok, hasilPerPokok, tarikhLawatan]);

  const totalKg = results.reduce((s, r) => s + r.kg, 0);

  const handleStageChange = (key: string, field: 'pct' | 'd', value: number) => {
    setStages(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSave = async () => {
    if (!user || !kebun) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'kebun', kebun.id, 'lawatan'), {
        tarikhLawatan,
        varieti: selectedVariety?.name,
        varietiKey: varieti,
        fasaUtama,
        saizKebun: kebun.saizKebun,
        jumlahPokok,
        hasilPerPokok,
        stages,
        totalKg,
        totalTan: totalKg / 1000,
        pegawaiNama: profile?.nama || '',
        pegawaiDaerah: profile?.daerah || '',
        negeri: kebun.negeri || '',
        createdAt: serverTimestamp(),
      });
      toast.success(t('calc.saved'));
      setShowResults(false);
    } catch (e) {
      console.error(e);
      toast.error(t('calc.saveFailed'));
    }
    setSaving(false);
  };

  const fasaLabel = (key: string) => {
    const stage = STAGES.find(s => s.key === key);
    return stage?.name || key;
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-forest">{t('calc.title')}</h2>
        <p className="text-xs text-gray-500">{t('calc.subtitle')}</p>
      </div>

      {/* Step 1: Select Kebun — Card Grid */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <label className="text-[10px] font-semibold text-gray-500 mb-3 block">{t('calc.selectKebun')}</label>

        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div>)}</div>
        ) : kebunList.length === 0 ? (
          <div className="text-center py-8">
            <span className="text-3xl">🌱</span>
            <p className="text-sm text-gray-500 mt-2">{t('calc.noKebunRegistered')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {kebunList.map(k => {
              const pokok = Math.round(k.saizKebun * k.kepadatan * (k.pctMatang / 100));
              const isSelected = selectedKebun === k.id;
              return (
                <div
                  key={k.id}
                  onClick={() => { setSelectedKebun(k.id); setShowResults(false); }}
                  className={`rounded-xl p-3.5 shadow-sm border cursor-pointer card-hover transition-all ${
                    isSelected
                      ? 'border-forest bg-forest/5 ring-2 ring-forest/30'
                      : 'border-gray-100 bg-white hover:border-forest/30'
                  }`}
                >
                  {/* Nama */}
                  <div className="flex items-center gap-2">
                    {k.negeri && NEGERI_FLAG[k.negeri] ? (
                      <img src={NEGERI_FLAG[k.negeri]} alt={k.negeri}
                        className="w-6 h-4 object-contain rounded-sm flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : k.negeri && NEGERI_FLAG_COLORS[k.negeri] ? (
                      <div className="w-6 h-4 rounded-sm flex-shrink-0 border border-gray-200 overflow-hidden">
                        <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].top }} />
                        <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].bottom }} />
                      </div>
                    ) : null}
                    <h4 className="font-bold text-forest text-sm truncate">{k.nama}</h4>
                    {isSelected && (
                      <span className="ml-auto text-[8px] bg-forest text-white px-1.5 py-0.5 rounded-full font-bold">✓</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                    {k.daerah || '-'}, {k.negeri || '-'}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[9px] bg-forest/10 text-forest px-2 py-0.5 rounded-full font-semibold">
                      {k.saizKebun} {t('kebun.ekar')}
                    </span>
                    <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-semibold">
                      {pokok} {t('kebun.pokok')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Selected kebun stats */}
        {kebun && (
          <div className="mt-4 bg-forest/5 rounded-xl p-3 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-lg font-bold text-forest">{kebun.saizKebun}</p><p className="text-[9px] text-gray-500">{t('kebun.ekar')}</p></div>
            <div><p className="text-lg font-bold text-forest">{jumlahPokok}</p><p className="text-[9px] text-gray-500">{t('calc.pokokBerbuah')}</p></div>
            <div><p className="text-lg font-bold text-forest">{kebun.pctMatang}%</p><p className="text-[9px] text-gray-500">{t('calc.matang')}</p></div>
          </div>
        )}
      </div>

      {kebun && (
        <>
          {/* Step 2: Varieti, Tarikh, Fasa Utama */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500">{t('calc.varieti')}</label>
                <select value={varieti} onChange={(e) => setVarieti(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-forest/30 focus:outline-none">
                  {VARIETIES.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">{t('calc.tarikhLawatan')}</label>
                <input type="date" value={tarikhLawatan} onChange={(e) => setTarikhLawatan(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-forest/30 focus:outline-none" />
              </div>
            </div>

            {/* Fasa Utama - the key dropdown */}
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('calc.fasaUtama')}</label>
              <p className="text-[9px] text-gray-400 mb-1">{t('calc.fasaDesc')}</p>
              <select
                value={fasaUtama}
                onChange={(e) => handleFasaChange(e.target.value)}
                className="w-full mt-1 px-3 py-3 border-2 border-forest/30 rounded-xl text-sm bg-forest/5 focus:ring-2 focus:ring-forest/30 focus:outline-none font-semibold text-forest"
              >
                {STAGES.map(s => (
                  <option key={s.key} value={s.key}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Selected fasa info */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-800">
                {t('calc.fasaSelected')} <span className="text-forest">{fasaLabel(fasaUtama)}</span>
              </p>
              <p className="text-[9px] text-amber-700 mt-0.5">
                {STAGES.find(s => s.key === fasaUtama)?.nota}
              </p>
              <p className="text-[9px] text-amber-600 mt-1">
                {t('calc.fasaAutoFill')}
              </p>
            </div>
          </div>

          {/* Step 3: Peringkat Detail (editable) */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-forest text-sm mb-1">{t('calc.step4')}</h3>
            <p className="text-[10px] text-gray-400 mb-3">{t('calc.step4Desc')}</p>
            <div className="space-y-3">
              {STAGES.map(stage => {
                const isActive = stages[stage.key]?.pct > 0;
                return (
                  <div key={stage.key} className={`border rounded-xl p-3 transition-all ${isActive ? 'border-forest/30 bg-forest/5' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-forest' : 'bg-gray-300'}`} />
                        <span className="text-xs font-semibold text-forest">{stage.name}</span>
                        <span className="text-[9px] text-moss">({stage.tempohHari})</span>
                      </div>
                      {stage.J && <span className="text-[9px] text-gray-400">J:{stage.J}d</span>}
                    </div>
                    {stage.J !== null ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[9px] text-gray-400">% Pokok</label>
                          <input type="number" value={stages[stage.key]?.pct || 0}
                            onChange={(e) => handleStageChange(stage.key, 'pct', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-forest focus:outline-none"
                            min="0" max="100" step="1" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-400">Usia (D) hari</label>
                          <input type="number" value={stages[stage.key]?.d || 0}
                            onChange={(e) => handleStageChange(stage.key, 'd', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-forest focus:outline-none"
                            min="0" />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-[9px] text-gray-400">% Pokok</label>
                        <input type="number" value={stages[stage.key]?.pct || 0}
                          onChange={(e) => handleStageChange(stage.key, 'pct', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-forest focus:outline-none"
                          min="0" max="100" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={`mt-3 text-xs font-semibold ${Math.abs(totalPct - 100) > 0.5 ? 'text-red-500' : 'text-moss'}`}>
              {t('calc.total')}: {totalPct.toFixed(0)}% {Math.abs(totalPct - 100) > 0.5 && t('calc.needTotal100')}
            </div>
          </div>

          {/* Calculate Button */}
          <button onClick={() => setShowResults(true)}
            className="w-full bg-gradient-forest text-white py-3.5 rounded-xl font-semibold shadow-lg active:scale-[0.98]">
            {t('calc.calculate')}
          </button>

          {/* Results */}
          {showResults && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-gold space-y-3">
              <h3 className="font-bold text-forest">{t('calc.results')}</h3>

              {/* Info badge */}
              <div className="bg-forest/5 rounded-lg px-3 py-2 text-[10px] text-gray-600">
                <span className="font-bold text-forest">{kebun.nama}</span> &bull; {selectedVariety?.name} &bull; Fasa: {fasaLabel(fasaUtama)}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-forest text-white">
                      <th className="px-2 py-2 text-left rounded-tl-lg">Peringkat</th>
                      <th className="px-2 py-2 text-right">%</th>
                      <th className="px-2 py-2 text-right">Baki Hari</th>
                      <th className="px-2 py-2 text-right">Jangkaan Tarikh</th>
                      <th className="px-2 py-2 text-right rounded-tr-lg">KG</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(r => (
                      <tr key={r.key} className="border-b border-gray-50">
                        <td className="px-2 py-2 font-medium">{r.name}</td>
                        <td className="px-2 py-2 text-right">{stages[r.key]?.pct.toFixed(0)}%</td>
                        <td className="px-2 py-2 text-right text-gray-400">{r.bakiHari != null && stages[r.key]?.pct > 0 ? `${r.bakiHari} hari` : '-'}</td>
                        <td className="px-2 py-2 text-right text-gray-400 text-[9px]">{r.tarikh || '-'}</td>
                        <td className="px-2 py-2 text-right font-semibold">{r.kg > 0 ? r.kg.toFixed(0) : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-gold/10 font-bold">
                      <td className="px-2 py-2" colSpan={4}>JUMLAH ANGGARAN</td>
                      <td className="px-2 py-2 text-right text-forest">{totalKg.toFixed(0)} kg</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Big total */}
              <div className="bg-forest/5 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500">{t('calc.anggaranKeseluruhan')}</p>
                <p className="text-3xl font-bold text-forest">{totalKg.toFixed(0)} <span className="text-base font-normal">kg</span></p>
                <p className="text-sm text-moss">({(totalKg / 1000).toFixed(3)} {t('calc.metrikTan')})</p>
              </div>

              <button onClick={handleSave} disabled={saving}
                className="w-full bg-gradient-gold text-black py-3 rounded-xl font-bold shadow-md active:scale-[0.98] disabled:opacity-50">
                {saving ? t('calc.saving') : t('calc.saveRecord')}
              </button>

              {/* Detail Kebun & Bulan Pengeluaran */}
              <div className="mt-4 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-forest border-b border-gray-100 pb-2">📋 Detail Kebun</h4>
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <p className="text-gray-500">Pekebun:</p>
                  <p className="font-semibold text-gray-800">{kebun.nama}</p>
                  <p className="text-gray-500">Negeri/Daerah:</p>
                  <p className="font-semibold text-gray-800">{kebun.negeri}, {kebun.daerah}</p>
                  <p className="text-gray-500">Keluasan:</p>
                  <p className="font-semibold text-gray-800">{kebun.saizKebun} ekar</p>
                  <p className="text-gray-500">Pokok Berbuah:</p>
                  <p className="font-semibold text-gray-800">{jumlahPokok} pokok</p>
                  <p className="text-gray-500">Varieti:</p>
                  <p className="font-semibold text-gray-800">{selectedVariety?.name || '-'}</p>
                  <p className="text-gray-500">Fasa Semasa:</p>
                  <p className="font-semibold text-forest">{fasaLabel(fasaUtama)}</p>
                  <p className="text-gray-500">Tarikh Lawatan:</p>
                  <p className="font-semibold text-gray-800">{new Date(tarikhLawatan).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {/* Jangkaan Bulan Pengeluaran */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <h4 className="text-sm font-bold text-forest border-b border-gray-100 pb-2">📅 Jangkaan Bulan Pengeluaran</h4>
                <div className="space-y-2">
                  {results
                    .filter(r => r.tarikh && stages[r.key]?.pct > 0)
                    .map(r => {
                      const d = new Date(tarikhLawatan);
                      d.setDate(d.getDate() + (r.bakiHari || 0));
                      const bulanStr = d.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
                      return (
                        <div key={r.key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-xs font-semibold text-forest">{r.name}</p>
                            <p className="text-[9px] text-gray-500">{stages[r.key]?.pct}% pokok &bull; {r.bakiHari} hari lagi</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gold">{bulanStr}</p>
                            <p className="text-[9px] text-gray-400">{r.kg.toFixed(0)} kg</p>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {/* Summary bulan */}
                {(() => {
                  const bulanSet = new Set<string>();
                  results.filter(r => r.bakiHari !== null && stages[r.key]?.pct > 0).forEach(r => {
                    const d = new Date(tarikhLawatan);
                    d.setDate(d.getDate() + (r.bakiHari || 0));
                    bulanSet.add(d.toLocaleDateString('ms-MY', { month: 'short' }));
                  });
                  const bulanArr = Array.from(bulanSet);
                  return bulanArr.length > 0 ? (
                    <div className="bg-gold/10 rounded-lg p-3 text-center">
                      <p className="text-[9px] text-gray-500">Jangkaan Musim Pengeluaran</p>
                      <p className="text-sm font-bold text-forest mt-1">
                        {bulanArr.join(' / ')}
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}
        </>
      )}

      {!kebun && kebunList.length > 0 && (
        <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
          <span className="text-3xl">👆</span>
          <p className="text-sm text-gray-500 mt-2">{t('calc.noKebun')}</p>
        </div>
      )}
    </div>
  );
}
