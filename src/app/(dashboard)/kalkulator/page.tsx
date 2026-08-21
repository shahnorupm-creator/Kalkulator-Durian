'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { collection, collectionGroup, query, onSnapshot, orderBy, addDoc, serverTimestamp, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { VARIETIES, STAGES, NEGERI_FLAG, NEGERI_FLAG_COLORS } from '@/lib/constants';
import toast from 'react-hot-toast';

interface VarietiEntry { usia: string; varieti: string; bilangan: number; }

interface KebunRecord {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
  saizKebun: number;
  kepadatan: number;
  pctMatang: number;
  jumlahPokok: number;
  usia5_9: number;
  usia10_15: number;
  usia16_19: number;
  usia20: number;
  varieti5_9: string;
  varieti10_15: string;
  varieti16_19: string;
  varieti20: string;
  varietiData?: VarietiEntry[];
}

interface StageInput { pct: number; d: number; }
interface VarietiResult { varietiKey: string; varietiName: string; bilPokok: number; hasilPerPokok: number; totalKg: number; }

const FASA_PRESETS: Record<string, Record<string, { pct: number; d: number }>> = {
  mataketam: { mataketam: { pct: 70, d: 15 }, berbunga: { pct: 10, d: 5 }, putik: { pct: 0, d: 0 }, kecil: { pct: 0, d: 0 }, besar: { pct: 0, d: 0 }, tidak: { pct: 20, d: 0 } },
  berbunga: { mataketam: { pct: 10, d: 25 }, berbunga: { pct: 60, d: 15 }, putik: { pct: 10, d: 5 }, kecil: { pct: 0, d: 0 }, besar: { pct: 0, d: 0 }, tidak: { pct: 20, d: 0 } },
  putik: { mataketam: { pct: 0, d: 0 }, berbunga: { pct: 10, d: 20 }, putik: { pct: 60, d: 20 }, kecil: { pct: 15, d: 10 }, besar: { pct: 0, d: 0 }, tidak: { pct: 15, d: 0 } },
  kecil: { mataketam: { pct: 0, d: 0 }, berbunga: { pct: 0, d: 0 }, putik: { pct: 10, d: 40 }, kecil: { pct: 65, d: 30 }, besar: { pct: 15, d: 5 }, tidak: { pct: 10, d: 0 } },
  besar: { mataketam: { pct: 0, d: 0 }, berbunga: { pct: 0, d: 0 }, putik: { pct: 0, d: 0 }, kecil: { pct: 22, d: 40 }, besar: { pct: 73, d: 2 }, tidak: { pct: 5, d: 0 } },
  tidak: { mataketam: { pct: 0, d: 0 }, berbunga: { pct: 0, d: 0 }, putik: { pct: 0, d: 0 }, kecil: { pct: 0, d: 0 }, besar: { pct: 0, d: 0 }, tidak: { pct: 100, d: 0 } },
};

export default function KalkulatorPage() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'superadmin' || profile?.role === 'admin_negeri' || profile?.role === 'admin_hq';
  const { t } = useLanguage();
  const [kebunList, setKebunList] = useState<KebunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKebun, setSelectedKebun] = useState<string>('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fasaUtama, setFasaUtama] = useState<string>('besar');
  const [tarikhLawatan, setTarikhLawatan] = useState(new Date().toISOString().split('T')[0]);
  const [stages, setStages] = useState<Record<string, StageInput>>(FASA_PRESETS['besar']);
  const [saving, setSaving] = useState(false);
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!user) return;
    const isAdminUser = profile?.role === 'superadmin' || profile?.role === 'admin_negeri' || profile?.role === 'admin_hq';
    const q = isAdminUser
      ? query(collection(db, 'kebun'), orderBy('nama'))
      : query(collection(db, 'kebun'), where('assignedTo', '==', user.uid), orderBy('nama'));
    const unsub = onSnapshot(q, (snap) => {
      setKebunList(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, [user, profile]);

  // Track latest lawatan per kebun for status badge
  const [lawatanMap, setLawatanMap] = useState<Record<string, { totalKg: number; createdAt: number }>>({});

  useEffect(() => {
    const unsub = onSnapshot(query(collectionGroup(db, 'lawatan')), (snap) => {
      const map: Record<string, { totalKg: number; createdAt: number }> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        const kebunId = data.kebunId || d.ref.parent.parent?.id || '';
        if (!kebunId) return;
        const time = data.createdAt?.seconds || 0;
        if (!map[kebunId] || time > map[kebunId].createdAt) {
          map[kebunId] = { totalKg: data.totalKg || 0, createdAt: time };
        }
      });
      setLawatanMap(map);
    });
    return () => unsub();
  }, []);

  const kebun = kebunList.find(k => k.id === selectedKebun);

  const jumlahPokokKebun = useMemo(() => {
    if (!kebun) return 0;
    if ((kebun.jumlahPokok || 0) > 0) return kebun.jumlahPokok;
    return Math.round(kebun.saizKebun * kebun.kepadatan * (kebun.pctMatang / 100));
  }, [kebun]);

  const varietiAggregate = useMemo(() => {
    if (!kebun) return [];
    const map: Record<string, number> = {};
    const hasValid = kebun.varietiData && kebun.varietiData.some(v => v.varieti && v.bilangan > 0);
    if (hasValid) {
      kebun.varietiData!.forEach(v => { if (v.varieti && v.bilangan > 0) map[v.varieti] = (map[v.varieti] || 0) + v.bilangan; });
    } else {
      if (kebun.varieti5_9 && (kebun.usia5_9 || 0) > 0) map[kebun.varieti5_9] = (map[kebun.varieti5_9] || 0) + kebun.usia5_9;
      if (kebun.varieti10_15 && (kebun.usia10_15 || 0) > 0) map[kebun.varieti10_15] = (map[kebun.varieti10_15] || 0) + kebun.usia10_15;
      if (kebun.varieti16_19 && (kebun.usia16_19 || 0) > 0) map[kebun.varieti16_19] = (map[kebun.varieti16_19] || 0) + kebun.usia16_19;
      if (kebun.varieti20 && (kebun.usia20 || 0) > 0) map[kebun.varieti20] = (map[kebun.varieti20] || 0) + kebun.usia20;
    }
    return Object.entries(map).map(([key, bilPokok]) => {
      const v = VARIETIES.find(x => x.key === key);
      return { varietiKey: key, varietiName: v?.name || key, bilPokok, hasilPerPokok: v?.hasil || 150 };
    });
  }, [kebun]);

  const totalPct = useMemo(() => Object.values(stages).reduce((s, v) => s + v.pct, 0), [stages]);

  const varietiResults: VarietiResult[] = useMemo(() => {
    if (!kebun || varietiAggregate.length === 0) return [];
    const producingPct = STAGES.reduce((sum, stage) => stage.J === null ? sum : sum + (stages[stage.key]?.pct || 0), 0);
    return varietiAggregate.map(v => ({ ...v, totalKg: (producingPct / 100) * v.bilPokok * v.hasilPerPokok }));
  }, [kebun, varietiAggregate, stages]);

  const grandTotalKg = varietiResults.reduce((s, v) => s + v.totalKg, 0);

  const handleFasaChange = (newFasa: string) => {
    setFasaUtama(newFasa);
    setStages(FASA_PRESETS[newFasa] || FASA_PRESETS['besar']);
  };

  const handleStageChange = (key: string, field: 'pct' | 'd', value: number) => {
    setStages(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const handleSelectKebun = (id: string) => {
    setSelectedKebun(id);
    setShowPopup(true);
  };

  const handleConfirmKebun = () => {
    setShowPopup(false);
    setStep(2);
  };

  const handleSave = async () => {
    if (!user || !kebun) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'kebun', kebun.id, 'lawatan'), {
        kebunId: kebun.id, kebunNama: kebun.nama, daerah: kebun.daerah, tarikhLawatan, fasaUtama,
        saizKebun: kebun.saizKebun, jumlahPokok: jumlahPokokKebun, stages,
        varietiResults: varietiResults.map(v => ({ key: v.varietiKey, name: v.varietiName, pokok: v.bilPokok, kg: v.totalKg })),
        totalKg: grandTotalKg, totalTan: grandTotalKg / 1000,
        pegawaiNama: profile?.nama || '', pegawaiDaerah: profile?.daerah || '', negeri: kebun.negeri || '',
        createdAt: serverTimestamp(),
      });
      toast.success(t('calc.saved'));
    } catch (e) { console.error(e); toast.error(t('calc.saveFailed')); }
    setSaving(false);
  };

  const fasaLabel = (key: string) => STAGES.find(s => s.key === key)?.name || key;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-forest">{t('calc.title')}</h2>
          <p className="text-xs text-gray-500">{t('calc.subtitle')}</p>
        </div>
        {step > 1 && (
          <button onClick={() => { setStep(step === 3 ? 2 : 1); }} className="text-xs text-forest underline">
            ← Kembali
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {[1, 2, 3].map(s => (
          <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${s <= step ? 'bg-forest' : 'bg-gray-200'}`} />
        ))}
      </div>

      {/* ═══════════════════ STEP 1: Pilih Pekebun ═══════════════════ */}
      {step === 1 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-gray-500">1. {t('calc.selectKebun')}</p>

          {loading ? (
            <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div>)}</div>
          ) : kebunList.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-2xl border border-gray-100">
              <span className="text-3xl">🌱</span>
              <p className="text-sm text-gray-500 mt-2">{t('calc.noKebunRegistered')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kebunList.map(k => {
                const pokok = (k.jumlahPokok || 0) > 0 ? k.jumlahPokok : Math.round(k.saizKebun * k.kepadatan * (k.pctMatang / 100));
                const entries = k.varietiData && k.varietiData.some(v => v.varieti && v.bilangan > 0)
                  ? k.varietiData.filter(v => v.varieti && v.bilangan > 0)
                  : [
                      k.varieti5_9 && (k.usia5_9 || 0) > 0 ? { varieti: k.varieti5_9, bilangan: k.usia5_9 } : null,
                      k.varieti10_15 && (k.usia10_15 || 0) > 0 ? { varieti: k.varieti10_15, bilangan: k.usia10_15 } : null,
                      k.varieti16_19 && (k.usia16_19 || 0) > 0 ? { varieti: k.varieti16_19, bilangan: k.usia16_19 } : null,
                    ].filter(Boolean) as { varieti: string; bilangan: number }[];
                const vMap: Record<string, number> = {};
                entries.forEach(e => { vMap[e.varieti] = (vMap[e.varieti] || 0) + e.bilangan; });

                return (
                  <div key={k.id} onClick={() => handleSelectKebun(k.id)}
                    className="rounded-xl p-3.5 shadow-sm border border-gray-100 bg-white cursor-pointer card-hover hover:border-forest/30 transition-all">
                    <div className="flex items-center gap-2">
                      {k.negeri && NEGERI_FLAG[k.negeri] ? (
                        <img src={NEGERI_FLAG[k.negeri]} alt={k.negeri} className="w-6 h-4 object-contain rounded-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      ) : k.negeri && NEGERI_FLAG_COLORS[k.negeri] ? (
                        <div className="w-6 h-4 rounded-sm border border-gray-200 overflow-hidden">
                          <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].top }} />
                          <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].bottom }} />
                        </div>
                      ) : null}
                      <h4 className="font-bold text-forest text-sm truncate">{k.nama}</h4>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate">{k.daerah || '-'}, {k.negeri || '-'}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-[9px] bg-forest/10 text-forest px-2 py-0.5 rounded-full font-semibold">{k.saizKebun} ekar</span>
                      <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full font-semibold">{pokok} pokok</span>
                    </div>
                    {Object.keys(vMap).length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {Object.entries(vMap).map(([vKey, total]) => (
                          <p key={vKey} className="text-[9px] text-gray-500">• {VARIETIES.find(v => v.key === vKey)?.name.split(' (')[0]} — <span className="font-semibold text-forest">{total}</span></p>
                        ))}
                      </div>
                    )}
                    {/* Anggaran status */}
                    {lawatanMap[k.id] && (
                      <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-2 py-1.5">
                        <p className="text-[9px] font-semibold text-green-700">✓ Anggaran hasil telah dikira</p>
                        <p className="text-[8px] text-green-600">Kemaskini: {new Date(lawatanMap[k.id].createdAt * 1000).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase()}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ STEP 2: Tarikh + Fasa + Peringkat ═══════════════════ */}
      {step === 2 && kebun && (
        <div className="space-y-4">
          {/* Selected kebun badge + varieti detail */}
          <div className="bg-forest/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-forest">{kebun.nama}</p>
                <p className="text-[9px] text-gray-500">{kebun.daerah}, {kebun.negeri}</p>
              </div>
              <button onClick={() => setStep(1)} className="text-[9px] text-forest underline">Tukar</button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] bg-white text-forest px-2 py-0.5 rounded-full font-semibold">{kebun.saizKebun} ekar</span>
              <span className="text-[9px] bg-white text-gold px-2 py-0.5 rounded-full font-semibold">{jumlahPokokKebun} pokok</span>
            </div>
            {varietiAggregate.length > 0 && (
              <div className="space-y-0.5 pt-1 border-t border-forest/10">
                {varietiAggregate.map(v => (
                  <p key={v.varietiKey} className="text-[9px] text-gray-600">• {v.varietiName.split(' (')[0]} — <span className="font-semibold text-forest">{v.bilPokok}</span></p>
                ))}
              </div>
            )}
          </div>

          {/* Tarikh & Fasa */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500">{t('calc.tarikhLawatan')}</label>
                <input type="date" value={tarikhLawatan} onChange={(e) => setTarikhLawatan(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-forest/30 focus:outline-none" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500">{t('calc.fasaUtama')}</label>
                <select value={fasaUtama} onChange={(e) => handleFasaChange(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border-2 border-forest/30 rounded-xl text-sm bg-forest/5 font-semibold text-forest focus:outline-none">
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <p className="text-[9px] text-amber-700">{STAGES.find(s => s.key === fasaUtama)?.nota}</p>
            </div>
          </div>

          {/* Pecahan Peringkat — compact */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <p className="text-[10px] font-semibold text-gray-500 mb-1">{t('calc.step4')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STAGES.map(stage => (
                <div key={stage.key} className={`border rounded-lg p-2 ${stages[stage.key]?.pct > 0 ? 'border-forest/30 bg-forest/5' : 'border-gray-100 bg-gray-50'}`}>
                  <p className="text-[9px] font-semibold text-forest mb-1 truncate">{stage.name}</p>
                  <div className="flex gap-1">
                    <div className="flex-1">
                      <input type="number" value={stages[stage.key]?.pct || 0}
                        onChange={(e) => handleStageChange(stage.key, 'pct', parseFloat(e.target.value) || 0)}
                        className="w-full px-1.5 py-1 border border-gray-200 rounded text-[11px] text-center focus:ring-1 focus:ring-forest focus:outline-none"
                        min="0" max="100" />
                      <p className="text-[7px] text-gray-600 text-center mt-0.5">%</p>
                    </div>
                    {stage.J !== null && (
                      <div className="flex-1">
                        <input type="number" value={stages[stage.key]?.d || 0}
                          onChange={(e) => handleStageChange(stage.key, 'd', parseInt(e.target.value) || 0)}
                          className="w-full px-1.5 py-1 border border-gray-200 rounded text-[11px] text-center focus:ring-1 focus:ring-forest focus:outline-none"
                          min="0" />
                        <p className="text-[7px] text-gray-600 text-center mt-0.5">hari</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className={`mt-2 text-[10px] font-semibold text-center ${Math.abs(totalPct - 100) > 0.5 ? 'text-red-500' : 'text-moss'}`}>
              Jumlah: {totalPct.toFixed(0)}% {Math.abs(totalPct - 100) > 0.5 && '(Mesti 100%)'}
            </div>
          </div>

          {/* Kira Button */}
          <button onClick={() => {
  // Pegawai wajib isi semua field — tidak boleh tinggal kosong
  if (!isAdmin) {
    const hasEmpty = Object.entries(stages).some(([key, val]) => {
      if (key === 'tidak') return false; // tidak berbuah tak perlu hari
      return val.pct > 0 && val.d <= 0;
    });
    if (hasEmpty) {
      toast.error('Sila isi semua hari (D) untuk peringkat yang mempunyai peratusan.');
      return;
    }
  }
  setStep(3);
}}
            disabled={Math.abs(totalPct - 100) > 0.5}
            className="w-full bg-gradient-forest text-white py-3.5 rounded-xl font-semibold shadow-lg active:scale-[0.98] disabled:opacity-50">
            {t('calc.calculate')}
          </button>
        </div>
      )}

      {/* ═══════════════════ STEP 3: Hasil ═══════════════════ */}
      {step === 3 && kebun && (
        <div className="space-y-4">
          {/* Single unified results card */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Card Header — dark green */}
            <div className="bg-forest px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{kebun.nama}</h3>
                  <p className="text-[10px] text-white/70">{kebun.daerah}, {kebun.negeri} &bull; {kebun.saizKebun} ekar &bull; {jumlahPokokKebun} pokok</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-white/60">Fasa</p>
                  <p className="text-xs font-bold text-gold">{fasaLabel(fasaUtama)}</p>
                </div>
              </div>
              <p className="text-[9px] text-white/50 mt-1">📅 {new Date(tarikhLawatan).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>

            {/* Varieti breakdown */}
            <div className="divide-y divide-gray-100">
              {varietiResults.map(v => (
                <div key={v.varietiKey} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-800">{v.varietiName}</p>
                    <p className="text-[9px] text-gray-400">{v.bilPokok} pokok × {v.hasilPerPokok} kg × {(totalPct - (stages['tidak']?.pct || 0)).toFixed(0)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-gold">{v.totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg</p>
                    <p className="text-[9px] text-gray-400">{(v.totalKg / 1000).toFixed(2)} MT</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Grand Total */}
            <div className="bg-gold/10 px-5 py-4 flex items-center justify-between border-t border-gold/20">
              <div>
                <p className="text-[9px] text-gray-500">Jumlah Anggaran Keseluruhan</p>
                <p className="text-2xl font-bold text-forest">{grandTotalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-sm font-normal">kg</span></p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-forest">{(grandTotalKg / 1000).toFixed(3)}</p>
                <p className="text-[9px] text-gray-500">Metrik Tan</p>
              </div>
            </div>

            {/* Action buttons inside card */}
            <div className="px-5 py-4 bg-gray-50 grid grid-cols-2 gap-3">
              <button onClick={() => setStep(2)} className="py-2.5 border border-gray-300 rounded-xl text-xs font-medium text-gray-600 bg-white">
                ← Ubah Peringkat
              </button>
              <button onClick={handleSave} disabled={saving}
                className="py-2.5 bg-gradient-gold text-black rounded-xl text-xs font-bold shadow-md active:scale-[0.98] disabled:opacity-50">
                {saving ? 'Menyimpan...' : '💾 Simpan Rekod'}
              </button>
            </div>
          </div>

          {/* Kira semula */}
          <button onClick={() => { setSelectedKebun(''); setStep(1); }}
            className="w-full py-3 text-sm font-semibold text-forest bg-forest/10 border-2 border-dashed border-forest/30 rounded-xl hover:bg-forest/20 hover:border-forest/50 transition-all active:scale-[0.98]">
            🔄 Kira Pekebun Lain
          </button>
        </div>
      )}

      {/* Popup Maklumat Kebun */}
      {showPopup && kebun && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={() => setShowPopup(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center gap-3">
              {kebun.negeri && NEGERI_FLAG[kebun.negeri] ? (
                <img src={NEGERI_FLAG[kebun.negeri]} alt={kebun.negeri} className="w-8 h-6 object-contain rounded-sm" />
              ) : kebun.negeri && NEGERI_FLAG_COLORS[kebun.negeri] ? (
                <div className="w-8 h-6 rounded-sm border border-gray-200 overflow-hidden">
                  <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[kebun.negeri].top }} />
                  <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[kebun.negeri].bottom }} />
                </div>
              ) : null}
              <div>
                <h3 className="text-lg font-bold text-forest">{kebun.nama}</h3>
                <p className="text-[10px] text-gray-500">{kebun.daerah}, {kebun.negeri}</p>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-forest/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-forest">{kebun.saizKebun}</p>
                <p className="text-[9px] text-gray-500">Ekar</p>
              </div>
              <div className="bg-forest/5 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-forest">{jumlahPokokKebun}</p>
                <p className="text-[9px] text-gray-500">Pokok</p>
              </div>
            </div>

            {/* Varieti list */}
            {varietiAggregate.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold text-gray-500">Senarai Varieti:</p>
                {varietiAggregate.map(v => (
                  <div key={v.varietiKey} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-700">{v.varietiName}</span>
                    <span className="text-xs font-bold text-forest">{v.bilPokok} pokok</span>
                  </div>
                ))}
              </div>
            )}

            {/* Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button onClick={() => setShowPopup(false)} className="py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-600">
                Batal
              </button>
              <button onClick={handleConfirmKebun} className="py-2.5 bg-gradient-forest text-white rounded-xl text-sm font-bold shadow-md active:scale-[0.98]">
                Teruskan →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
