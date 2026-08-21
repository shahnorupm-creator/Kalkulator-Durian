'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { collection, addDoc, query, onSnapshot, orderBy, serverTimestamp, doc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { NEGERI_DAERAH, SENARAI_NEGERI, VARIETIES, NEGERI_FLAG_COLORS, NEGERI_FLAG, formatMasaBM } from '@/lib/constants';
import toast from 'react-hot-toast';

interface KebunRecord {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
  mukim: string;
  alamat: string;
  latlong: string;
  noTelefon: string;
  saizKebun: number;
  kepadatan: number;
  pctMatang: number;
  usia5_9: number;
  usia10_15: number;
  usia16_19: number;
  usia20: number;
  varieti5_9: string;
  varieti10_15: string;
  varieti16_19: string;
  varieti20: string;
  jumlahPokok: number;
  varieti: string[];
  varietiData?: VarietiEntry[];
  assignedTo: string;
  assignedNama: string;
  createdBy: string;
  createdAt: { seconds: number; nanoseconds: number } | null;
  updatedAt: { seconds: number; nanoseconds: number } | null;
}

interface VarietiEntry {
  usia: string;
  varieti: string;
  bilangan: number;
}

interface PegawaiOption {
  uid: string;
  nama: string;
  negeri: string;
}

// Konfigurasi 3 kolum usia pokok
const USIA_BRACKETS = [
  { key: '5-9', label: '5 - 9 Tahun' },
  { key: '10-15', label: '10 - 15 Tahun' },
  { key: '16+', label: '16 Tahun Atas' },
] as const;

export default function ProfilKebunPage() {
  const { user, profile, isSuperAdmin, isAnyAdmin, signOut } = useAuth();
  const { t } = useLanguage();
  const [kebunList, setKebunList] = useState<KebunRecord[]>([]);
  const [pegawaiList, setPegawaiList] = useState<PegawaiOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingKebun, setEditingKebun] = useState<KebunRecord | null>(null);
  const [filterNegeri, setFilterNegeri] = useState('Semua');
  const [filterDaerah, setFilterDaerah] = useState('Semua');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [errors, setErrors] = useState<string[]>([]);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);

  const userNegeri = profile?.negeri || '';
  const canAccessAllNegeri = isSuperAdmin || profile?.role === 'admin_hq' || profile?.role === 'admin_negeri';

  const [form, setForm] = useState({
    negeri: '',
    daerah: '',
    nama: '',
    mukim: '',
    alamat: '',
    latlong: '',
    noTelefon: '',
    saizKebun: '',
    kepadatan: '70',
    pctMatang: '90',
    assignedTo: '',
  });

  const defaultVarietiData: VarietiEntry[] = [
    { usia: '5-9', varieti: '', bilangan: 0 },
    { usia: '10-15', varieti: '', bilangan: 0 },
    { usia: '16+', varieti: '', bilangan: 0 },
  ];

  const [varietiData, setVarietiData] = useState<VarietiEntry[]>(defaultVarietiData);

  // Helper functions for varietiData
  const addVarietiEntry = (usia: string) => {
    setVarietiData(prev => [...prev, { usia, varieti: '', bilangan: 0 }]);
  };

  const removeVarietiEntry = (index: number) => {
    setVarietiData(prev => prev.filter((_, i) => i !== index));
  };

  const updateVarietiEntry = (index: number, field: keyof VarietiEntry, value: string | number) => {
    setVarietiData(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  useEffect(() => {
    if (!canAccessAllNegeri && userNegeri) {
      setForm(prev => ({ ...prev, negeri: userNegeri }));
    }
  }, [canAccessAllNegeri, userNegeri]);

  const daerahOptions = form.negeri ? NEGERI_DAERAH[form.negeri] || [] : [];

  // Jumlah pokok auto-calculate from varietiData
  const jumlahPokokFromUsia = varietiData.reduce((sum, item) => sum + (item.bilangan || 0), 0);

  useEffect(() => {
    if (!user) return;
    let q;
    if (canAccessAllNegeri) {
      q = query(collection(db, 'kebun'), orderBy('nama'));
    } else {
      q = query(collection(db, 'kebun'), where('assignedTo', '==', user.uid), orderBy('nama'));
    }
    const unsub = onSnapshot(q, (snap) => {
      setKebunList(snap.docs.map(d => ({ id: d.id, ...d.data() } as KebunRecord)));
      setLoading(false);
    });
    return () => unsub();
  }, [user, canAccessAllNegeri]);

  useEffect(() => {
    if (!isSuperAdmin && !isAnyAdmin) return;
    const q = query(collection(db, 'users'));
    const unsub = onSnapshot(q, (snap) => {
      setPegawaiList(snap.docs.map(d => ({ uid: d.id, nama: d.data().nama || '-', negeri: d.data().negeri || '' })));
    });
    return () => unsub();
  }, [isSuperAdmin, isAnyAdmin]);

  // Auto-format: Capitalize Each Word
  const ACRONYMS = ['FAMA', 'IOI', 'HQ', 'GPS', 'MARDI', 'MPOB', 'RISDA', 'FELDA', 'FELCRA', 'JPM', 'KPM'];
  const capitalizeWords = (str: string) =>
    str.replace(/\b[\p{L}']+/gu, (word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.includes(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });

  // Dapatkan lokasi GPS dari device + reverse geocode alamat
  const handleGetLocation = () => {
    if (!('geolocation' in navigator)) {
      toast.error('Peranti ini tidak menyokong GPS.');
      return;
    }

    setGettingLocation(true);
    setLocationAccuracy(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const long = pos.coords.longitude.toFixed(6);
        setForm(prev => ({ ...prev, latlong: `${lat}, ${long}` }));
        setLocationAccuracy(pos.coords.accuracy);

        // Reverse geocode — dapatkan alamat dari koordinat
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${long}&accept-language=ms`
          );
          const data = await res.json();
          if (data.address) {
            // Bina alamat structured dari response
            const addr = data.address;
            const parts = [
              addr.road,
              addr.quarter || addr.suburb || addr.village,
              addr.town || addr.city,
              addr.district,
              addr.state,
              addr.postcode,
            ].filter(Boolean);
            const alamatGPS = parts.join(', ');

            setForm(prev => ({
              ...prev,
              latlong: `${lat}, ${long}`,
              alamat: capitalizeWords(alamatGPS),
            }));
            toast.success('Lokasi & alamat berjaya dikemas kini!');
          } else if (data.display_name) {
            setForm(prev => ({
              ...prev,
              latlong: `${lat}, ${long}`,
              alamat: capitalizeWords(data.display_name.split(',').slice(0, 5).join(',').trim()),
            }));
            toast.success('Lokasi & alamat berjaya dikemas kini!');
          } else {
            toast.success('Lokasi GPS berjaya dikemas kini!');
          }
        } catch (e) {
          // Geocode gagal tapi koordinat tetap berjaya
          toast.success('Lokasi GPS berjaya. Alamat tidak dapat dikesan.');
        }

        setGettingLocation(false);
      },
      (err) => {
        setGettingLocation(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Kebenaran lokasi ditolak. Sila benarkan akses lokasi dalam tetapan pelayar.');
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          toast.error('Lokasi tidak tersedia. Pastikan GPS dihidupkan.');
        } else if (err.code === err.TIMEOUT) {
          toast.error('Tamat masa mendapatkan lokasi. Cuba lagi di tempat terbuka.');
        } else {
          toast.error('Gagal mendapatkan lokasi GPS.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleNegeriChange = (negeri: string) => {
    setForm({ ...form, negeri, daerah: '' });
  };

  const validate = (): boolean => {
    const errs: string[] = [];
    if (!form.nama.trim()) errs.push('Nama Pekebun');
    if (!form.negeri) errs.push('Negeri');
    if (!form.daerah) errs.push('Daerah');
    if (!form.mukim.trim()) errs.push('Mukim');
    if (!form.alamat.trim()) errs.push('Alamat Kebun');
    if (!form.saizKebun || parseFloat(form.saizKebun) <= 0) errs.push('Keluasan Tanaman (Ekar)');
    setErrors(errs);
    return errs.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!user) return;
    setSaving(true);
    try {
      const assignedTo = form.assignedTo || user.uid;
      const assignedPegawai = pegawaiList.find(p => p.uid === assignedTo);
      const jumlahPokok = jumlahPokokFromUsia > 0 ? jumlahPokokFromUsia : Math.round(parseFloat(form.saizKebun) * (parseInt(form.kepadatan) || 70) * ((parseInt(form.pctMatang) || 90) / 100));

      // Build legacy fields from varietiData for backward compatibility
      const legacy5_9 = varietiData.filter(v => v.usia === '5-9');
      const legacy10_15 = varietiData.filter(v => v.usia === '10-15');
      const legacy16 = varietiData.filter(v => v.usia === '16+');

      const data = {
        nama: form.nama.trim(),
        negeri: form.negeri,
        daerah: form.daerah,
        mukim: form.mukim.trim(),
        alamat: form.alamat.trim(),
        latlong: form.latlong.trim(),
        noTelefon: form.noTelefon.trim() || '-',
        saizKebun: parseFloat(form.saizKebun) || 0,
        kepadatan: parseInt(form.kepadatan) || 70,
        pctMatang: parseInt(form.pctMatang) || 90,
        // Legacy fields (first entry of each bracket for backward compat)
        usia5_9: legacy5_9.reduce((s, v) => s + v.bilangan, 0),
        usia10_15: legacy10_15.reduce((s, v) => s + v.bilangan, 0),
        usia16_19: legacy16.reduce((s, v) => s + v.bilangan, 0),
        usia20: 0,
        varieti5_9: legacy5_9[0]?.varieti || '',
        varieti10_15: legacy10_15[0]?.varieti || '',
        varieti16_19: legacy16[0]?.varieti || '',
        varieti20: '',
        // New multi-varieti data
        varietiData: varietiData.filter(v => v.varieti && v.bilangan > 0),
        jumlahPokok,
        varieti: [...new Set(varietiData.map(v => v.varieti).filter(Boolean))],
        assignedTo,
        assignedNama: assignedPegawai?.nama || profile?.nama || '',
        createdBy: editingKebun?.createdBy || user.uid,
      };

      if (editingKebun) {
        await updateDoc(doc(db, 'kebun', editingKebun.id), { ...data, updatedAt: serverTimestamp() });
        toast.success(t('kebun.updated'));
      } else {
        await addDoc(collection(db, 'kebun'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast.success(t('kebun.saved'));
      }
      resetForm();
    } catch (e) {
      console.error(e);
      toast.error(t('kebun.saveFailed'));
    }
    setSaving(false);
  };

  const resetForm = () => {
    setForm({
      negeri: canAccessAllNegeri ? '' : userNegeri,
      daerah: '', nama: '', mukim: '', alamat: '', latlong: '', noTelefon: '',
      saizKebun: '', kepadatan: '70', pctMatang: '90',
      assignedTo: '',
    });
    setVarietiData([
      { usia: '5-9', varieti: '', bilangan: 0 },
      { usia: '10-15', varieti: '', bilangan: 0 },
      { usia: '16+', varieti: '', bilangan: 0 },
    ]);
    setShowForm(false);
    setEditingKebun(null);
    setErrors([]);
    setLocationAccuracy(null);
  };

  const handleEdit = (k: KebunRecord) => {
    setEditingKebun(k);
    setForm({
      negeri: k.negeri || '', daerah: k.daerah || '', nama: k.nama || '',
      mukim: k.mukim || '', alamat: k.alamat || '', latlong: k.latlong || '',
      noTelefon: k.noTelefon || '', saizKebun: String(k.saizKebun || ''),
      kepadatan: String(k.kepadatan || 70), pctMatang: String(k.pctMatang || 90),
      assignedTo: k.assignedTo || '',
    });

    // Hydrate varietiData from new field or legacy fields
    const record = k as KebunRecord & { varietiData?: VarietiEntry[] };
    if (record.varietiData && record.varietiData.length > 0) {
      setVarietiData(record.varietiData);
    } else {
      // Convert legacy single-varieti-per-bracket to varietiData
      const legacy: VarietiEntry[] = [];
      if (k.varieti5_9 && (k.usia5_9 || 0) > 0) legacy.push({ usia: '5-9', varieti: k.varieti5_9, bilangan: k.usia5_9 });
      if (k.varieti10_15 && (k.usia10_15 || 0) > 0) legacy.push({ usia: '10-15', varieti: k.varieti10_15, bilangan: k.usia10_15 });
      if (k.varieti16_19 && (k.usia16_19 || 0) > 0) legacy.push({ usia: '16+', varieti: k.varieti16_19, bilangan: k.usia16_19 });
      if (k.varieti20 && (k.usia20 || 0) > 0) legacy.push({ usia: '16+', varieti: k.varieti20, bilangan: k.usia20 });
      // Jika tiada data langsung, set default satu row per bracket
      if (legacy.length === 0) {
        setVarietiData([
          { usia: '5-9', varieti: '', bilangan: 0 },
          { usia: '10-15', varieti: '', bilangan: 0 },
          { usia: '16+', varieti: '', bilangan: 0 },
        ]);
      } else {
        setVarietiData(legacy);
      }
    }

    setShowForm(true);
    setErrors([]);
    setLocationAccuracy(null);
    // Auto scroll ke atas supaya form edit nampak
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
  };

  const handleDelete = async (id: string) => {
    if (!user || !confirm(t('kebun.delete'))) return;
    await deleteDoc(doc(db, 'kebun', id));
    toast.success(t('kebun.deleted'));
  };

  const filtered = kebunList.filter(k => {
    if (filterNegeri !== 'Semua' && k.negeri !== filterNegeri) return false;
    if (filterDaerah !== 'Semua' && k.daerah !== filterDaerah) return false;
    if (search && !k.nama?.toLowerCase().includes(search.toLowerCase()) && !k.daerah?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const negeriWithData = [...new Set(kebunList.map(k => k.negeri).filter(Boolean))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-forest">{t('kebun.title')}</h2>
          {canAccessAllNegeri && (
            <p className="text-xs text-gray-500">
              {t('kebun.subtitleAdmin')}
            </p>
          )}
        </div>
        <button onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="bg-forest text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-md hover:bg-moss transition-all active:scale-95">
          {showForm ? t('kebun.closeBtn') : t('kebun.addBtn')}
        </button>
      </div>

      {!canAccessAllNegeri && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <span className="text-sm">📍</span>
          <p className="text-xs text-blue-700">{t('kebun.assignedInfo')}</p>
        </div>
      )}

      {/* Error Banner */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-red-700">{t('kebun.requiredFields')}</p>
          <ul className="mt-1 text-xs text-red-600 list-disc list-inside">
            {errors.map(e => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Form Card */}
      {showForm && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-forest text-sm">
            {editingKebun ? t('kebun.formTitleEdit') : t('kebun.formTitleNew')}
          </h3>

          {editingKebun && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[10px] text-amber-700">
              Sedang mengedit: <strong>{editingKebun.nama}</strong>
            </div>
          )}

          {/* Assign — Admin only */}
          {isAnyAdmin && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3">
              <label className="text-[10px] font-semibold text-purple-700">{t('kebun.assignTo')}</label>
              <select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-purple-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-purple-300 focus:outline-none">
                <option value="">{t('kebun.selectPegawai')}</option>
                {pegawaiList.map(p => <option key={p.uid} value={p.uid}>{p.nama} {p.negeri ? `(${p.negeri})` : ''}</option>)}
              </select>
            </div>
          )}

          {/* Negeri & Daerah */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.negeri')} *</label>
              {canAccessAllNegeri ? (
                <select value={form.negeri} onChange={(e) => handleNegeriChange(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-forest/30 focus:outline-none">
                  <option value="">{t('kebun.selectNegeri')}</option>
                  {SENARAI_NEGERI.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <input value={form.negeri || userNegeri} readOnly className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-100 font-semibold text-forest" />
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.daerah')} *</label>
              <select value={form.daerah} onChange={(e) => setForm({ ...form, daerah: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:ring-2 focus:ring-forest/30 focus:outline-none"
                disabled={!form.negeri}>
                <option value="">{t('kebun.selectDaerah')}</option>
                {daerahOptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Nama Mukim & Nama Pekebun */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.mukim')} *</label>
              <input value={form.mukim} onChange={(e) => setForm({ ...form, mukim: capitalizeWords(e.target.value) })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="Contoh: Pertang" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.nama')} *</label>
              <input value={form.nama} onChange={(e) => setForm({ ...form, nama: capitalizeWords(e.target.value) })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder={t('kebun.nama')} />
            </div>
          </div>

          {/* Keluasan & Alamat */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.keluasan')} *</label>
              <input type="number" value={form.saizKebun} onChange={(e) => setForm({ ...form, saizKebun: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="2.7" min="0" step="0.1" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.alamat')} *</label>
              <input value={form.alamat} onChange={(e) => setForm({ ...form, alamat: capitalizeWords(e.target.value) })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="Lot 1927, Air Baning, 72400" />
            </div>
          </div>

          {/* Lat/Long & No Telefon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.latlong')}</label>
              <div className="flex gap-1.5 mt-1">
                <input value={form.latlong} onChange={(e) => setForm({ ...form, latlong: e.target.value })}
                  className="flex-1 min-w-0 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                  placeholder="3.04, 102.22" />
                <button type="button" onClick={handleGetLocation} disabled={gettingLocation}
                  title="Dapatkan lokasi GPS semasa"
                  className="shrink-0 px-3 py-2.5 bg-forest text-white rounded-xl text-sm font-semibold active:scale-95 disabled:opacity-50 transition-all">
                  {gettingLocation ? '⏳' : '📍'}
                </button>
              </div>
              {locationAccuracy !== null && (
                <p className="text-[9px] text-moss mt-1">✓ Ketepatan ±{Math.round(locationAccuracy)} meter</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500">{t('kebun.noTelefon')}</label>
              <input value={form.noTelefon} onChange={(e) => setForm({ ...form, noTelefon: e.target.value })}
                className="w-full mt-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-forest/30 focus:outline-none"
                placeholder="013-7717886" />
            </div>
          </div>

          {/* Pilih Varieti & Tentukan Bilangan Pokok */}
          <div>
            <label className="text-[10px] font-semibold text-gray-500 mb-2 block">{t('kebun.varieti')}</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {USIA_BRACKETS.map(bracket => {
                const entries = varietiData.filter(v => v.usia === bracket.key);
                return (
                  <div key={bracket.key} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                    {/* Header usia */}
                    <div className="bg-gold/15 px-3 py-2 flex items-center justify-between">
                      <p className="text-[10px] font-bold text-forest">{bracket.label}</p>
                      <button type="button" onClick={() => addVarietiEntry(bracket.key)}
                        className="text-[10px] bg-forest text-white w-5 h-5 rounded-full font-bold flex items-center justify-center active:scale-90">+</button>
                    </div>
                    <div className="p-2 space-y-2">
                      {entries.length === 0 && (
                        <p className="text-[9px] text-gray-400 text-center py-2">Tiada varieti. Klik + untuk tambah.</p>
                      )}
                      {entries.map((entry) => {
                        const globalIdx = varietiData.indexOf(entry);
                        return (
                          <div key={globalIdx} className="bg-gray-50 rounded-lg p-2 space-y-1.5 relative">
                            <button type="button" onClick={() => removeVarietiEntry(globalIdx)}
                              className="absolute top-1 right-1 text-gray-300 hover:text-red-400 text-sm leading-none">×</button>
                            <select
                              value={entry.varieti}
                              onChange={(e) => {
                                const val = e.target.value;
                                updateVarietiEntry(globalIdx, 'varieti', val);
                                if (!val) updateVarietiEntry(globalIdx, 'bilangan', 0);
                              }}
                              className="w-full px-1.5 py-1.5 border border-gray-200 rounded-lg text-[9px] bg-white focus:ring-1 focus:ring-forest focus:outline-none"
                            >
                              <option value="">-- Varieti --</option>
                              {VARIETIES.map(v => <option key={v.key} value={v.key}>{v.name}</option>)}
                            </select>
                            <input
                              type="number"
                              value={entry.bilangan || ''}
                              onChange={(e) => updateVarietiEntry(globalIdx, 'bilangan', parseInt(e.target.value) || 0)}
                              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center font-semibold text-forest focus:ring-1 focus:ring-forest focus:outline-none"
                              min="0"
                              placeholder="0"
                            />
                            <p className="text-[8px] text-gray-400 text-center">{t('kebun.bilanganPokok')}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            {jumlahPokokFromUsia > 0 && (
              <p className="text-xs text-forest font-bold mt-3 text-center bg-forest/5 rounded-lg py-2">
                {t('kebun.jumlahPokok')}: {jumlahPokokFromUsia} {t('kebun.pokok')}
              </p>
            )}
          </div>

          {/* Preview */}
          {form.saizKebun && (
            <div className="bg-forest/5 rounded-xl p-3 text-xs text-gray-600 space-y-1">
              <p className="text-sm font-bold text-forest mb-2">{t('kebun.keberhasilan')}</p>
              <p>📐 Keluasan: <strong>{form.saizKebun} ekar</strong></p>
              {jumlahPokokFromUsia > 0 && <p>🌳 Jumlah Pokok: <strong>{jumlahPokokFromUsia} pokok</strong></p>}
              {varietiData.some(v => v.varieti && v.bilangan > 0) && (
                <>
                  <div className="flex items-center gap-1.5 mt-2 mb-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-forest" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z"/>
                      <circle cx="8" cy="13" r="1.2"/><circle cx="12" cy="13" r="1.2"/><circle cx="16" cy="13" r="1.2"/>
                      <circle cx="8" cy="17" r="1.2"/><circle cx="12" cy="17" r="1.2"/><circle cx="16" cy="17" r="1.2"/>
                    </svg>
                    <span className="text-xs font-semibold text-forest">Pecahan Varieti Mengikut Usia:</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {USIA_BRACKETS.map(bracket => {
                      const entries = varietiData.filter(v => v.usia === bracket.key && v.varieti && v.bilangan > 0);
                      return (
                        <div key={bracket.key} className="bg-white rounded-lg p-2 border border-gray-100">
                          <p className="text-[9px] font-bold text-forest mb-1 border-b border-gray-100 pb-1">{bracket.label}</p>
                          {entries.length === 0 ? (
                            <p className="text-[8px] text-gray-300">-</p>
                          ) : (
                            <div className="space-y-0.5">
                              {entries.map((entry, i) => (
                                <p key={i} className="text-[9px] text-gray-600">
                                  • <strong>{VARIETIES.find(v => v.key === entry.varieti)?.name}</strong> — {entry.bilangan}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Save */}
          <div className="flex gap-3">
            {editingKebun && (
              <button onClick={resetForm} className="px-4 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-600">{t('kebun.cancel')}</button>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex-1 bg-gradient-forest text-white py-3 rounded-xl font-semibold shadow-lg active:scale-[0.98] disabled:opacity-50">
              {saving ? t('kebun.saving') : editingKebun ? t('kebun.update') : t('kebun.save')}
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search */}
      <div className="space-y-2">
        {canAccessAllNegeri && negeriWithData.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {['Semua', ...negeriWithData].map(n => (
              <button key={n} onClick={() => { setFilterNegeri(n); setFilterDaerah('Semua'); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${filterNegeri === n ? 'bg-forest text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Daerah filter */}
        {(() => {
          const scopedKebun = filterNegeri !== 'Semua' ? kebunList.filter(k => k.negeri === filterNegeri) : kebunList;
          const daerahWithData = [...new Set(scopedKebun.map(k => k.daerah).filter(Boolean))].sort();
          if (daerahWithData.length > 1) {
            return (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {['Semua', ...daerahWithData].map(d => (
                  <button key={d} onClick={() => setFilterDaerah(d)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${filterDaerah === d ? 'bg-gold text-black' : 'bg-white text-gray-600 border border-gray-200'}`}>
                    {d}
                  </button>
                ))}
              </div>
            );
          }
          return null;
        })()}

        <div className="flex gap-2 items-center">
          <input placeholder={t('kebun.search')} value={search} onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-forest/30 focus:outline-none" />
          {/* Grid/List Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('list')}
              className={`px-2.5 py-1.5 rounded-md text-xs transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-forest font-bold' : 'text-gray-400'}`}>
              ☰
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`px-2.5 py-1.5 rounded-md text-xs transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-forest font-bold' : 'text-gray-400'}`}>
              ⊞
            </button>
          </div>
        </div>
      </div>

      {/* Kebun List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-3/4 mb-2"/><div className="h-3 bg-gray-200 rounded w-1/2"/></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
          <span className="text-4xl block mb-3">🌱</span>
          <p className="text-gray-500 text-sm">{search ? t('kebun.notFound') : t('kebun.empty')}</p>
          {!showForm && !search && <button onClick={() => setShowForm(true)} className="mt-3 text-forest text-sm font-semibold underline">{t('kebun.firstKebun')}</button>}
        </div>
      ) : (
        viewMode === 'list' ? (
          /* LIST VIEW — compact table */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-forest/5 text-[9px] font-bold text-forest border-b border-gray-100">
              <span className="col-span-3">Pekebun</span>
              <span className="col-span-2">Daerah</span>
              <span className="col-span-1 text-center">Ekar</span>
              <span className="col-span-1 text-center">Pokok</span>
              <span className="col-span-3">Varieti</span>
              <span className="col-span-2 text-center">Status</span>
            </div>
            {filtered.map(k => {
              const pokok = k.jumlahPokok || 0;
              const hasVarietiData = (k.varietiData && k.varietiData.some(v => v.varieti && v.bilangan > 0)) || k.varieti5_9 || k.varieti10_15 || k.varieti16_19;
              const isComplete = pokok > 0 && hasVarietiData && !!k.alamat && !!k.mukim && !!k.latlong && !!k.noTelefon && k.noTelefon !== '-';
              const varietiNames = (() => {
                if (k.varietiData && k.varietiData.length > 0) {
                  const map: Record<string, number> = {};
                  k.varietiData.forEach(v => { if (v.varieti && v.bilangan > 0) map[v.varieti] = (map[v.varieti] || 0) + v.bilangan; });
                  return Object.entries(map).map(([vKey]) => VARIETIES.find(v => v.key === vKey)?.name.split(' (')[0] || vKey);
                }
                return [k.varieti5_9, k.varieti10_15, k.varieti16_19].filter(Boolean).map(vKey => VARIETIES.find(v => v.key === vKey)?.name.split(' (')[0] || vKey);
              })();
              return (
                <div key={k.id} onClick={() => handleEdit(k)}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center cursor-pointer hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-all">
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    {k.negeri && NEGERI_FLAG[k.negeri] ? (
                      <img src={NEGERI_FLAG[k.negeri]} alt={k.negeri} className="w-5 h-3.5 object-contain rounded-sm flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : k.negeri && NEGERI_FLAG_COLORS[k.negeri] ? (
                      <div className="w-4 h-3 rounded-sm border border-gray-200 overflow-hidden flex-shrink-0">
                        <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].top }} />
                        <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].bottom }} />
                      </div>
                    ) : null}
                    <span className="text-[10px] font-bold text-forest truncate">{k.nama}</span>
                  </div>
                  <span className="col-span-2 text-[9px] text-gray-500 truncate">{k.daerah || '-'}</span>
                  <span className="col-span-1 text-[9px] text-center font-semibold text-forest">{k.saizKebun}</span>
                  <span className="col-span-1 text-[9px] text-center font-semibold text-gold">{pokok}</span>
                  <span className="col-span-3 text-[8px] text-gray-500 truncate">{varietiNames.join(', ')}</span>
                  <span className="col-span-2 text-center">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold ${isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {isComplete ? '✓ Lengkap' : '⚠ Kemaskini'}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(k => {
            const pokok = k.jumlahPokok || 0;
            const hasVarietiData = k.varietiData && k.varietiData.some(v => v.varieti && v.bilangan > 0);
            const hasLegacyVarieti = (!k.varietiData || k.varietiData.length === 0) && (k.varieti5_9 || k.varieti10_15 || k.varieti16_19);
            const hasVarieti = hasVarietiData || hasLegacyVarieti;
            const isComplete = pokok > 0 && hasVarieti && !!k.alamat && !!k.mukim && !!k.latlong && !!k.noTelefon && k.noTelefon !== '-';

            // Senarai perkara belum lengkap untuk tooltip
            const missingItems: string[] = [];
            if (pokok <= 0) missingItems.push('Bilangan Pokok');
            if (!hasVarieti) missingItems.push('Varieti Pokok');
            if (!k.latlong) missingItems.push('Koordinat GPS');
            if (!k.noTelefon || k.noTelefon === '-') missingItems.push('No. Telefon');
            if (!k.alamat) missingItems.push('Alamat Kebun');
            if (!k.mukim) missingItems.push('Mukim');

            const varietiNames = (() => {
              if (k.varietiData && k.varietiData.length > 0) {
                const map: Record<string, number> = {};
                k.varietiData.forEach(v => {
                  if (v.varieti && v.bilangan > 0) map[v.varieti] = (map[v.varieti] || 0) + v.bilangan;
                });
                return Object.entries(map).map(([vKey, total]) => {
                  const name = VARIETIES.find(v => v.key === vKey)?.name.split(' (')[0] || vKey;
                  return `${name} (${total})`;
                });
              }
              return [
                k.varieti5_9 && VARIETIES.find(v => v.key === k.varieti5_9)?.name.split(' (')[0],
                k.varieti10_15 && VARIETIES.find(v => v.key === k.varieti10_15)?.name.split(' (')[0],
                k.varieti16_19 && VARIETIES.find(v => v.key === k.varieti16_19)?.name.split(' (')[0],
              ].filter(Boolean) as string[];
            })();
            const uniqueVarieti = [...new Set(varietiNames)];

            return (
              <div key={k.id}
                className={`bg-white rounded-xl p-3.5 shadow-sm border cursor-pointer card-hover relative ${
                  isComplete ? 'border-gray-100' : 'border-amber-200'
                }`}
                onClick={() => handleEdit(k)}>
                {/* Status badge with tooltip */}
                <div className="absolute top-2.5 right-2.5 group">
                  <div className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold cursor-default ${
                    isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {isComplete ? t('kebun.complete') : t('kebun.incomplete')}
                  </div>
                  {!isComplete && missingItems.length > 0 && (
                    <div className="hidden group-hover:block absolute top-full right-0 mt-1 z-50 w-44 bg-gray-800 text-white rounded-lg p-2.5 shadow-lg text-[9px] leading-relaxed">
                      <p className="font-bold mb-1 text-amber-300">⚠ Perlu dikemaskini:</p>
                      <ul className="space-y-0.5">
                        {missingItems.map(item => (
                          <li key={item} className="flex items-center gap-1">
                            <span className="text-red-300">•</span> {item}
                          </li>
                        ))}
                      </ul>
                      <div className="absolute -top-1 right-3 w-2 h-2 bg-gray-800 rotate-45" />
                    </div>
                  )}
                </div>

                {/* Nama */}
                <div className="flex items-center gap-2">
                  {k.negeri && (
                    NEGERI_FLAG[k.negeri] ? (
                      <img src={NEGERI_FLAG[k.negeri]} alt={k.negeri}
                        className="w-6 h-4 object-contain rounded-sm flex-shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : NEGERI_FLAG_COLORS[k.negeri] ? (
                      <div className="w-6 h-4 rounded-sm flex-shrink-0 border border-gray-200 overflow-hidden">
                        <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].top }} />
                        <div className="w-full h-1/2" style={{ background: NEGERI_FLAG_COLORS[k.negeri].bottom }} />
                      </div>
                    ) : null
                  )}
                  <h4 className="font-bold text-forest text-sm pr-16 truncate">{k.nama}</h4>
                </div>
                <p className="text-[10px] text-gray-500 mt-0.5 truncate">
                  {k.daerah || '-'}, {k.negeri || '-'} &bull; {k.alamat || '-'}
                </p>

                {/* Stats row */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] bg-forest/10 text-forest px-2 py-0.5 rounded-full font-semibold">
                    {k.saizKebun || 0} ekar
                  </span>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                    pokok > 0 ? 'bg-gold/10 text-gold' : 'bg-red-50 text-red-400'
                  }`}>
                    {pokok > 0 ? `${pokok} pokok` : '0 pokok'}
                  </span>
                </div>

                {/* Varieti */}
                {uniqueVarieti.length > 0 && (
                  <div className="mt-1.5 space-y-0.5">
                    {uniqueVarieti.map((v, i) => (
                      <p key={i} className="text-[9px] text-moss">• {v}</p>
                    ))}
                  </div>
                )}

                {/* Timestamp */}
                {(k.updatedAt || k.createdAt) && (
                  <p className="text-[8px] text-gray-400 mt-1.5">
                    🕒 {(() => {
                      const ts = k.updatedAt || k.createdAt;
                      if (!ts || !ts.seconds) return '-';
                      const d = new Date(ts.seconds * 1000);
                      return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }) + ', ' + formatMasaBM(d);
                    })()}
                    {k.updatedAt && k.createdAt && k.updatedAt.seconds !== k.createdAt.seconds ? ' (dikemas kini)' : ''}
                  </p>
                )}

                {/* Assigned */}
                {isAnyAdmin && k.assignedNama && (
                  <p className="text-[8px] text-purple-500 mt-1">👤 {k.assignedNama}</p>
                )}

                {/* Delete */}
                {isAnyAdmin && (
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(k.id); }}
                    className="absolute bottom-2.5 right-2.5 text-gray-200 hover:text-red-400 text-sm transition-colors">×</button>
                )}
              </div>
            );
          })}
          <p className="text-[10px] text-gray-400 text-center pt-2">{t('kebun.total')}: {filtered.length} {t('kebun.pekebun')}</p>
        </div>
        )
      )}

      {/* Ringkasan Negeri */}
      {kebunList.length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="text-sm font-bold text-forest flex items-center gap-2">
            📊 Ringkasan {filterNegeri !== 'Semua' ? filterNegeri : 'Keseluruhan'}
            {filterDaerah !== 'Semua' && <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full">{filterDaerah}</span>}
          </h3>

          {(() => {
            const scopedList = filtered;
            const totalPekebun = scopedList.length;
            const totalEkar = scopedList.reduce((s, k) => s + (k.saizKebun || 0), 0);
            const totalPokok = scopedList.reduce((s, k) => s + (k.jumlahPokok || 0), 0);

            // Aggregate varieti across all visible pekebun
            const varietiTotals: Record<string, number> = {};
            scopedList.forEach(k => {
              if (k.varietiData && k.varietiData.some(v => v.varieti && v.bilangan > 0)) {
                k.varietiData.forEach(v => {
                  if (v.varieti && v.bilangan > 0) varietiTotals[v.varieti] = (varietiTotals[v.varieti] || 0) + v.bilangan;
                });
              } else {
                if (k.varieti5_9 && (k.usia5_9 || 0) > 0) varietiTotals[k.varieti5_9] = (varietiTotals[k.varieti5_9] || 0) + k.usia5_9;
                if (k.varieti10_15 && (k.usia10_15 || 0) > 0) varietiTotals[k.varieti10_15] = (varietiTotals[k.varieti10_15] || 0) + k.usia10_15;
                if (k.varieti16_19 && (k.usia16_19 || 0) > 0) varietiTotals[k.varieti16_19] = (varietiTotals[k.varieti16_19] || 0) + k.usia16_19;
                if (k.varieti20 && (k.usia20 || 0) > 0) varietiTotals[k.varieti20] = (varietiTotals[k.varieti20] || 0) + k.usia20;
              }
            });

            const varietiSorted = Object.entries(varietiTotals).sort((a, b) => b[1] - a[1]);

            return (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-forest/5 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-forest">{totalPekebun}</p>
                    <p className="text-[9px] text-gray-500">Jumlah Pekebun</p>
                  </div>
                  <div className="bg-forest/5 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-forest">{totalEkar.toFixed(1)}</p>
                    <p className="text-[9px] text-gray-500">Jumlah Ekar</p>
                  </div>
                  <div className="bg-forest/5 rounded-xl p-3 text-center">
                    <p className="text-xl font-bold text-forest">{totalPokok.toLocaleString()}</p>
                    <p className="text-[9px] text-gray-500">Jumlah Pokok</p>
                  </div>
                </div>

                {/* Varieti breakdown */}
                {varietiSorted.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-2">Pecahan Mengikut Varieti:</p>
                    <div className="space-y-1.5">
                      {(() => {
                        const totalVarietiPokok = varietiSorted.reduce((s, [, t]) => s + t, 0);
                        return varietiSorted.map(([vKey, total]) => {
                          const pct = totalVarietiPokok > 0 ? ((total / totalVarietiPokok) * 100).toFixed(0) : '0';
                          return (
                            <div key={vKey} className="flex items-center gap-2">
                              <div className="flex-1">
                                <div className="flex justify-between items-center mb-0.5">
                                  <span className="text-[10px] font-semibold text-gray-700">{VARIETIES.find(v => v.key === vKey)?.name || vKey}</span>
                                <span className="text-[9px] text-forest font-bold">{total.toLocaleString()} pokok ({pct}%)</span>
                              </div>
                              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-forest/60 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                        );
                        });
                      })()}
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* Sign Out */}
      <button onClick={signOut} className="w-full mt-4 py-3 text-sm text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-all">
        {t('nav.logout')}
      </button>
    </div>
  );
}
