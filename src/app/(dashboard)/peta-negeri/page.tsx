'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import {
  formatNamaPaparan,
  huraiLatLong,
  NEGERI_FLAG,
  SENARAI_NEGERI,
} from '@/lib/constants';
import { pilihLawatanSemasaPerKebun, type LawatanSemasaBase } from '@/lib/lawatan';
import { unjurLawatan } from '@/lib/unjuran';
import { useTarikhSemasa } from '@/lib/useTarikhSemasa';
import { mulaTourJikaBaharu } from '@/lib/useTour';

interface KebunPeta {
  id: string;
  nama: string;
  negeri: string;
  daerah: string;
  alamat?: string;
  latlong?: string;
  saizKebun: number;
  jumlahPokok: number;
  assignedTo?: string;
  assignedNama?: string;
}

interface LawatanRekod extends LawatanSemasaBase {
  totalKg?: number;
}

type Koordinat = [number, number];
type Poligon = Koordinat[][];

interface CiriGeoNegeri {
  type: 'Feature';
  properties: { shapeName?: string; shapeISO?: string };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: Koordinat[][] | Koordinat[][][];
  };
}

interface KoleksiGeoNegeri {
  type: 'FeatureCollection';
  features: CiriGeoNegeri[];
}

const NAMA_GEO_KE_SISTEM: Record<string, string> = {
  Malacca: 'Melaka',
  Penang: 'Pulau Pinang',
};

const NEGERI_LABEL_KECIL = new Set(['Perlis', 'Pulau Pinang', 'Negeri Sembilan', 'Melaka']);

const LEBAR_PETA = 900;
const TINGGI_PETA = 410;
const PADDING_PETA = 18;

function namaSistem(ciri: CiriGeoNegeri): string {
  const nama = ciri.properties.shapeName || '';
  return NAMA_GEO_KE_SISTEM[nama] || nama;
}

function poligonCiri(ciri: CiriGeoNegeri): Poligon[] {
  return ciri.geometry.type === 'Polygon'
    ? [ciri.geometry.coordinates as Poligon]
    : ciri.geometry.coordinates as Poligon[];
}

function semuaTitik(ciri: CiriGeoNegeri): Koordinat[] {
  return poligonCiri(ciri).flatMap(poligon => poligon.flatMap(lingkaran => lingkaran));
}

interface BatasGeo { minLong: number; maxLong: number; minLat: number; maxLat: number }

function kiraBatas(ciri: CiriGeoNegeri[]): BatasGeo {
  const titik = ciri.flatMap(semuaTitik);
  return titik.reduce<BatasGeo>((batas, [long, lat]) => ({
    minLong: Math.min(batas.minLong, long),
    maxLong: Math.max(batas.maxLong, long),
    minLat: Math.min(batas.minLat, lat),
    maxLat: Math.max(batas.maxLat, lat),
  }), { minLong: Infinity, maxLong: -Infinity, minLat: Infinity, maxLat: -Infinity });
}

function unjurTitik([long, lat]: Koordinat, batas: BatasGeo): [number, number] {
  const lebarGeo = Math.max(0.001, batas.maxLong - batas.minLong);
  const tinggiGeo = Math.max(0.001, batas.maxLat - batas.minLat);
  const skala = Math.min(
    (LEBAR_PETA - PADDING_PETA * 2) / lebarGeo,
    (TINGGI_PETA - PADDING_PETA * 2) / tinggiGeo
  );
  const lebarLukisan = lebarGeo * skala;
  const tinggiLukisan = tinggiGeo * skala;
  const offsetX = (LEBAR_PETA - lebarLukisan) / 2;
  const offsetY = (TINGGI_PETA - tinggiLukisan) / 2;
  return [
    offsetX + (long - batas.minLong) * skala,
    offsetY + (batas.maxLat - lat) * skala,
  ];
}

function laluanSvg(ciri: CiriGeoNegeri, batas: BatasGeo): string {
  return poligonCiri(ciri).map(poligon =>
    poligon.map(lingkaran => lingkaran.map((titik, index) => {
      const [x, y] = unjurTitik(titik, batas);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ') + ' Z').join(' ')
  ).join(' ');
}

function pusatCiri(ciri: CiriGeoNegeri, batas: BatasGeo): [number, number] {
  const titik = semuaTitik(ciri);
  const minLong = Math.min(...titik.map(item => item[0]));
  const maxLong = Math.max(...titik.map(item => item[0]));
  const minLat = Math.min(...titik.map(item => item[1]));
  const maxLat = Math.max(...titik.map(item => item[1]));
  return unjurTitik([(minLong + maxLong) / 2, (minLat + maxLat) / 2], batas);
}

function warnaJumlah(jumlah: number, terpilih: boolean): string {
  if (terpilih) return '#C98A2C';
  if (jumlah >= 10) return '#1F4D36';
  if (jumlah >= 5) return '#3F775B';
  if (jumlah > 0) return '#86A995';
  return '#CBD5CF';
}

export default function PetaNegeriPage() {
  const {
    user,
    profile,
    isSuperAdmin,
    loading: authLoading,
    hasPageAccess,
  } = useAuth();
  const router = useRouter();
  const tarikhSemasa = useTarikhSemasa();
  const [kebun, setKebun] = useState<KebunPeta[]>([]);
  const [lawatan, setLawatan] = useState<LawatanRekod[]>([]);
  const [ciriPeta, setCiriPeta] = useState<CiriGeoNegeri[]>([]);
  const [petaLoading, setPetaLoading] = useState(true);
  const [petaRalat, setPetaRalat] = useState('');
  const [loading, setLoading] = useState(true);
  const [ralat, setRalat] = useState('');
  const [negeriDipilih, setNegeriDipilih] = useState('Semua');
  const [daerahDipilih, setDaerahDipilih] = useState('Semua');

  const role = profile?.role;
  const nasional = isSuperAdmin || role === 'admin_hq';
  const userNegeri = profile?.negeri?.trim() || '';
  const adaNegeriSah = nasional || SENARAI_NEGERI.includes(userNegeri);
  const bolehAkses = hasPageAccess('peta_negeri');

  useEffect(() => {
    if (!authLoading && profile && !bolehAkses) router.replace('/');
  }, [authLoading, profile, bolehAkses, router]);

  // Muat sempadan negeri sebenar daripada GeoJSON tempatan (boleh digunakan offline
  // selepas aset dicache oleh pelayar/PWA).
  useEffect(() => {
    let aktif = true;
    const muatPeta = async () => {
      try {
        const response = await fetch('/maps/malaysia-adm1.geojson');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const koleksi = await response.json() as KoleksiGeoNegeri;
        const negeriSistem = koleksi.features.filter(ciri => SENARAI_NEGERI.includes(namaSistem(ciri)));
        if (aktif) setCiriPeta(negeriSistem);
      } catch (error) {
        console.error('Gagal memuatkan sempadan negeri:', error);
        if (aktif) setPetaRalat('Sempadan peta tidak dapat dimuatkan.');
      } finally {
        if (aktif) setPetaLoading(false);
      }
    };
    void muatPeta();
    return () => { aktif = false; };
  }, []);

  useEffect(() => {
    if (!user || !profile || !bolehAkses) {
      setKebun([]);
      setLoading(false);
      return;
    }
    if (!nasional && !SENARAI_NEGERI.includes(userNegeri)) {
      setKebun([]);
      setLoading(false);
      setNegeriDipilih('Semua');
      return;
    }

    setLoading(true);
    setRalat('');
    let q;
    if (nasional) {
      q = query(collection(db, 'kebun'), orderBy('nama'));
    } else if (role === 'admin_negeri') {
      q = query(collection(db, 'kebun'), where('negeri', '==', userNegeri));
    } else {
      q = query(collection(db, 'kebun'), where('assignedTo', '==', user.uid), orderBy('nama'));
    }

    const unsubscribe = onSnapshot(q, snapshot => {
      const semua = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KebunPeta));
      // Pertahanan tambahan: pengguna bukan nasional tidak menerima paparan negeri lain.
      setKebun(nasional ? semua : semua.filter(item => item.negeri === userNegeri));
      setLoading(false);
    }, error => {
      console.error('Gagal memuatkan Peta Negeri:', error);
      setRalat('Maklumat peta tidak dapat dimuatkan. Sila cuba semula.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, profile, bolehAkses, nasional, role, userNegeri]);

  // Muat rekod lawatan bagi kebun dalam skop supaya anggaran hasil (MT) boleh dikira
  // mengikut negeri, daerah dan pekebun — konsisten dengan Dashboard dan Laporan.
  useEffect(() => {
    setLawatan([]);
    if (kebun.length === 0) return;
    const rekodMengikutKebun = new Map<string, LawatanRekod[]>();
    let aktif = true;
    const terbit = () => {
      if (aktif) setLawatan(Array.from(rekodMengikutKebun.values()).flat());
    };
    const unsubs = kebun.map(k => onSnapshot(
      query(collection(db, 'kebun', k.id, 'lawatan')),
      snap => {
        rekodMengikutKebun.set(k.id, snap.docs.map(d => {
          const data = d.data() as Omit<LawatanRekod, 'id' | 'kebunId'> & { kebunId?: string };
          return { ...data, id: d.id, kebunId: k.id } as LawatanRekod;
        }));
        terbit();
      }
    ));
    return () => { aktif = false; unsubs.forEach(u => u()); };
  }, [kebun]);

  useEffect(() => {
    if (!nasional && adaNegeriSah) setNegeriDipilih(userNegeri);
    if (nasional) setNegeriDipilih('Semua');
  }, [nasional, adaNegeriSah, userNegeri]);

  // Reset pilihan daerah apabila negeri bertukar.
  useEffect(() => { setDaerahDipilih('Semua'); }, [negeriDipilih]);

  useEffect(() => {
    if (!loading && bolehAkses && adaNegeriSah) mulaTourJikaBaharu('peta');
  }, [loading, bolehAkses, adaNegeriSah]);

  // Anggaran hasil (kg) bagi setiap kebun berdasarkan lawatan terkini (satu per kebun).
  const kgPerKebun = useMemo(() => {
    const idSah = new Set(kebun.map(k => k.id));
    const terkini = pilihLawatanSemasaPerKebun(lawatan, idSah);
    const map: Record<string, number> = {};
    terkini.forEach(rekod => {
      const unjuran = unjurLawatan(rekod, tarikhSemasa);
      map[rekod.kebunId] = unjuran.totalKg;
    });
    return map;
  }, [kebun, lawatan, tarikhSemasa]);

  const statistikNegeri = useMemo(() => {
    const map: Record<string, { kebun: number; ekar: number; pokok: number; kg: number; daerah: Set<string>; gps: number }> = {};
    SENARAI_NEGERI.forEach(negeri => {
      map[negeri] = { kebun: 0, ekar: 0, pokok: 0, kg: 0, daerah: new Set(), gps: 0 };
    });
    kebun.forEach(item => {
      if (!map[item.negeri]) return;
      map[item.negeri].kebun += 1;
      map[item.negeri].ekar += Number(item.saizKebun) || 0;
      map[item.negeri].pokok += Number(item.jumlahPokok) || 0;
      map[item.negeri].kg += kgPerKebun[item.id] || 0;
      if (item.daerah) map[item.negeri].daerah.add(item.daerah);
      if (huraiLatLong(item.latlong)) map[item.negeri].gps += 1;
    });
    return map;
  }, [kebun, kgPerKebun]);

  const bolehPilihNegeri = (negeri: string) => nasional || negeri === userNegeri;

  // Kebun dalam negeri dipilih (sebelum tapisan daerah).
  const kebunNegeri = negeriDipilih === 'Semua'
    ? kebun
    : kebun.filter(item => item.negeri === negeriDipilih);

  // Ringkasan daerah: kebun, ekar, pokok dan hasil (MT) — untuk jadual drill-down.
  const ringkasanDaerah = useMemo(() => {
    const map: Record<string, { kebun: number; ekar: number; pokok: number; kg: number }> = {};
    kebunNegeri.forEach(item => {
      const daerah = item.daerah || 'Daerah Tidak Direkod';
      if (!map[daerah]) map[daerah] = { kebun: 0, ekar: 0, pokok: 0, kg: 0 };
      map[daerah].kebun += 1;
      map[daerah].ekar += Number(item.saizKebun) || 0;
      map[daerah].pokok += Number(item.jumlahPokok) || 0;
      map[daerah].kg += kgPerKebun[item.id] || 0;
    });
    return Object.entries(map)
      .map(([daerah, d]) => ({ daerah, ...d }))
      .sort((a, b) => b.kg - a.kg || b.kebun - a.kebun || a.daerah.localeCompare(b.daerah, 'ms'));
  }, [kebunNegeri, kgPerKebun]);

  // Kebun yang dipaparkan dalam senarai: ditapis lagi mengikut daerah dipilih.
  const kebunPaparan = daerahDipilih === 'Semua'
    ? kebunNegeri
    : kebunNegeri.filter(item => (item.daerah || 'Daerah Tidak Direkod') === daerahDipilih);

  const jumlahEkar = kebunNegeri.reduce((sum, item) => sum + (Number(item.saizKebun) || 0), 0);
  const jumlahPokok = kebunNegeri.reduce((sum, item) => sum + (Number(item.jumlahPokok) || 0), 0);
  const jumlahMt = kebunNegeri.reduce((sum, item) => sum + (kgPerKebun[item.id] || 0), 0) / 1000;
  const kebunTanpaGps = kebunPaparan.filter(item => !huraiLatLong(item.latlong));
  const jumlahGps = kebunPaparan.length - kebunTanpaGps.length;

  const batasPeta = useMemo<BatasGeo>(() =>
    ciriPeta.length > 0
      ? kiraBatas(ciriPeta)
      : { minLong: 99, maxLong: 120, minLat: 0, maxLat: 8 },
  [ciriPeta]);
  const pilihanToggle = nasional ? SENARAI_NEGERI : [userNegeri].filter(Boolean);

  if (!authLoading && !bolehAkses) return null;

  return (
    <div className="space-y-4">
      <div data-tour="peta-tajuk" className="bg-gradient-forest rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Peta Negeri</h2>
            <p className="mt-0.5 text-[10px] text-white/65">Paparan kebun durian mengikut negeri dan skop pengguna</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-bold">
            {nasional ? 'Seluruh Malaysia' : userNegeri || 'Negeri Belum Ditetapkan'}
          </span>
        </div>
      </div>

      {!adaNegeriSah ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <span className="text-3xl">📍</span>
          <h3 className="mt-2 text-sm font-bold text-amber-800">Negeri Belum Ditetapkan</h3>
          <p className="mt-1 text-xs text-amber-700">
            Hubungi Admin Negeri atau Super Admin untuk menetapkan negeri pada profil anda sebelum menggunakan Peta Negeri.
          </p>
        </div>
      ) : (
        <>
          <div className={`rounded-xl border px-4 py-3 text-xs ${nasional ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
            {nasional
              ? 'Anda mempunyai capaian nasional. Pilih mana-mana negeri pada peta untuk melihat ringkasan.'
              : `Capaian dikunci kepada ${userNegeri}. Data negeri lain tidak boleh dibuka.`}
          </div>

          <div data-tour="peta-kpi" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
              <p className="text-[9px] text-gray-400">Jumlah Kebun</p>
              <p className="mt-1 text-xl font-bold text-forest">{kebunNegeri.length}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
              <p className="text-[9px] text-gray-400">Keluasan</p>
              <p className="mt-1 text-xl font-bold text-forest">{jumlahEkar.toFixed(1)}</p>
              <p className="text-[8px] text-gray-400">ekar</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
              <p className="text-[9px] text-gray-400">Bilangan Pokok</p>
              <p className="mt-1 text-xl font-bold text-forest">{jumlahPokok.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
              <p className="text-[9px] text-gray-400">Anggaran Hasil</p>
              <p className="mt-1 text-xl font-bold text-gold">{jumlahMt.toFixed(2)}</p>
              <p className="text-[8px] text-gray-400">metrik tan</p>
            </div>
          </div>

          <div data-tour="peta-interaktif" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-forest">Peta Interaktif Malaysia</h3>
                <p className="text-[9px] text-gray-400">Sempadan negeri sebenar — klik peta atau pilihan bendera</p>
              </div>
              {nasional && negeriDipilih !== 'Semua' && (
                <button onClick={() => setNegeriDipilih('Semua')} className="rounded-lg bg-forest/10 px-2.5 py-1.5 text-[9px] font-bold text-forest">
                  Lihat Semua
                </button>
              )}
            </div>

            {/* Toggle negeri menggunakan bendera sebenar. */}
            <div className="mb-3 flex gap-2 overflow-x-auto pb-2">
              {nasional && (
                <button
                  type="button"
                  onClick={() => setNegeriDipilih('Semua')}
                  className={`flex min-w-[125px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all ${negeriDipilih === 'Semua' ? 'border-forest bg-forest text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600'}`}
                >
                  <img src="/malaysia.jpg" alt="Bendera Malaysia" className="h-7 w-10 rounded object-cover" />
                  <span>
                    <span className="block text-[9px] font-bold">Semua Negeri</span>
                    <span className={`block text-[8px] ${negeriDipilih === 'Semua' ? 'text-white/70' : 'text-gray-400'}`}>{kebun.length} kebun</span>
                  </span>
                </button>
              )}
              {pilihanToggle.map(negeri => {
                const aktif = negeriDipilih === negeri;
                return (
                  <button
                    key={negeri}
                    type="button"
                    onClick={() => setNegeriDipilih(negeri)}
                    className={`flex min-w-[125px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all ${aktif ? 'border-forest bg-forest text-white shadow-sm' : 'border-gray-200 bg-white text-gray-600 hover:border-forest/30'}`}
                  >
                    <img src={NEGERI_FLAG[negeri]} alt={`Bendera ${negeri}`} className="h-7 w-10 rounded object-contain" />
                    <span className="min-w-0">
                      <span className="block truncate text-[9px] font-bold">{negeri}</span>
                      <span className={`block text-[8px] ${aktif ? 'text-white/70' : 'text-gray-400'}`}>{statistikNegeri[negeri]?.kebun || 0} kebun</span>
                    </span>
                  </button>
                );
              })}
            </div>

            {loading || petaLoading ? (
              <div className="h-72 animate-pulse rounded-xl bg-gray-100" />
            ) : ralat || petaRalat ? (
              <div className="rounded-xl bg-red-50 p-6 text-center text-xs text-red-600">{ralat || petaRalat}</div>
            ) : (
              <svg viewBox={`0 0 ${LEBAR_PETA} ${TINGGI_PETA}`} role="img" aria-label="Peta sempadan negeri Malaysia" className="h-auto w-full rounded-xl border border-slate-100 bg-slate-50">
                {ciriPeta.map(ciri => {
                  const negeri = namaSistem(ciri);
                  const dibenarkan = bolehPilihNegeri(negeri);
                  const jumlah = statistikNegeri[negeri]?.kebun || 0;
                  const terpilih = negeriDipilih === negeri;
                  const [labelX, labelY] = pusatCiri(ciri, batasPeta);
                  return (
                    <g
                      key={negeri}
                      role="button"
                      tabIndex={dibenarkan ? 0 : -1}
                      aria-label={`${negeri}: ${jumlah} kebun${dibenarkan ? '' : ', tidak dibenarkan'}`}
                      onClick={() => dibenarkan && setNegeriDipilih(negeri)}
                      onKeyDown={event => {
                        if (dibenarkan && (event.key === 'Enter' || event.key === ' ')) setNegeriDipilih(negeri);
                      }}
                      className={dibenarkan ? 'cursor-pointer outline-none' : 'cursor-not-allowed'}
                      opacity={dibenarkan ? 1 : 0.2}
                    >
                      <title>{`${negeri}: ${jumlah} kebun`}</title>
                      <path
                        d={laluanSvg(ciri, batasPeta)}
                        fill={warnaJumlah(jumlah, terpilih)}
                        fillRule="evenodd"
                        stroke={terpilih ? '#7A4D00' : '#FFFFFF'}
                        strokeWidth={terpilih ? 2.5 : 1.2}
                        vectorEffect="non-scaling-stroke"
                        className="transition-colors hover:brightness-110"
                      />
                      <text
                        x={labelX}
                        y={labelY}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={NEGERI_LABEL_KECIL.has(negeri) ? 7 : negeri === 'Terengganu' ? 8 : 9}
                        fontWeight="700"
                        fill="#FFFFFF"
                        pointerEvents="none"
                        style={{ paintOrder: 'stroke', stroke: '#1F4D36', strokeWidth: 2.5 }}
                      >
                        {negeri}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[8px] text-gray-400">
              <span>Warna lebih gelap menunjukkan bilangan kebun yang lebih tinggi.</span>
              <span>
                Sempadan: <a href="https://www.geoboundaries.org/" target="_blank" rel="noopener noreferrer" className="underline">geoBoundaries</a> · ODbL 1.0 · sumber OSM/Wambacher
              </span>
            </div>
          </div>

          <div data-tour="peta-butiran" className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                {negeriDipilih !== 'Semua' && NEGERI_FLAG[negeriDipilih] && (
                  <img src={NEGERI_FLAG[negeriDipilih]} alt={`Bendera ${negeriDipilih}`} className="h-8 w-11 rounded object-contain" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-forest">{negeriDipilih === 'Semua' ? 'Seluruh Malaysia' : negeriDipilih}</h3>
                  <p className="text-[9px] text-gray-400">
                    {jumlahGps}/{kebunPaparan.length} kebun mempunyai koordinat GPS
                    {kebunTanpaGps.length > 0 ? ` · ${kebunTanpaGps.length} belum mempunyai tag lokasi` : ''}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-forest/10 px-2.5 py-1 text-[9px] font-bold text-forest">{kebunPaparan.length} kebun</span>
            </div>

            {kebunTanpaGps.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <span className="text-sm" aria-hidden="true">⚠️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-amber-800">
                      Kebun Tanpa Tag Lokasi ({kebunTanpaGps.length})
                    </p>
                    <p className="mt-0.5 text-[8px] text-amber-700">
                      Kemas kini koordinat GPS di Modul Kebun supaya lokasi boleh dipaparkan dan disahkan.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {kebunTanpaGps.map(item => (
                        <span key={item.id} className="rounded-lg border border-amber-200 bg-white px-2 py-1 text-[8px] font-semibold text-amber-800">
                          {formatNamaPaparan(item.nama)} · {formatNamaPaparan(item.daerah) || 'Daerah Tidak Direkod'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {kebunPaparan.length === 0 ? (
              <div className="py-8 text-center">
                <span className="text-3xl">🌱</span>
                <p className="mt-2 text-xs font-semibold text-gray-500">Tiada kebun dalam skop ini.</p>
              </div>
            ) : (
              <div className="mt-3 space-y-4">
                {/* Jadual ringkasan daerah — klik untuk tapis senarai pekebun. */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-bold text-gray-600">
                      Pengeluaran Mengikut Daerah {negeriDipilih !== 'Semua' ? `(${negeriDipilih})` : ''}
                    </p>
                    {daerahDipilih !== 'Semua' && (
                      <button onClick={() => setDaerahDipilih('Semua')} className="rounded-lg bg-forest/10 px-2 py-1 text-[8px] font-bold text-forest">
                        Semua Daerah
                      </button>
                    )}
                  </div>
                  <div className="overflow-hidden rounded-xl border border-gray-100">
                    <div className="grid grid-cols-[1.4fr_0.6fr_0.7fr_0.8fr_0.9fr] gap-1 bg-forest/5 px-3 py-2 text-[8px] font-bold text-forest">
                      <span>Daerah</span>
                      <span className="text-right">Kebun</span>
                      <span className="text-right">Ekar</span>
                      <span className="text-right">Pokok</span>
                      <span className="text-right">Hasil (MT)</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      {ringkasanDaerah.map(d => {
                        const aktif = daerahDipilih === d.daerah;
                        return (
                          <button
                            key={d.daerah}
                            type="button"
                            onClick={() => setDaerahDipilih(aktif ? 'Semua' : d.daerah)}
                            className={`grid w-full grid-cols-[1.4fr_0.6fr_0.7fr_0.8fr_0.9fr] gap-1 px-3 py-2 text-left text-[9px] transition-colors ${aktif ? 'bg-gold/15 font-bold text-forest' : 'odd:bg-white even:bg-gray-50 text-gray-700 hover:bg-forest/5'}`}
                          >
                            <span className="truncate">{formatNamaPaparan(d.daerah)}</span>
                            <span className="text-right">{d.kebun}</span>
                            <span className="text-right">{d.ekar.toFixed(1)}</span>
                            <span className="text-right">{d.pokok.toLocaleString()}</span>
                            <span className="text-right font-bold text-gold">{(d.kg / 1000).toFixed(2)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <p className="mt-1 text-[8px] text-gray-400">Klik mana-mana daerah untuk menapis senarai pekebun di bawah.</p>
                </div>

                {/* Senarai pekebun dengan anggaran hasil. */}
                <div>
                  <p className="mb-2 text-[10px] font-bold text-gray-600">
                    Senarai Kebun{daerahDipilih !== 'Semua' ? ` — ${formatNamaPaparan(daerahDipilih)}` : ''} ({kebunPaparan.length})
                  </p>
                  <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                    {kebunPaparan.map(item => {
                      const gps = huraiLatLong(item.latlong);
                      const mt = (kgPerKebun[item.id] || 0) / 1000;
                      return (
                        <div key={item.id} className="rounded-xl border border-gray-100 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold text-forest">{formatNamaPaparan(item.nama)}</p>
                              <p className="text-[9px] text-gray-500">{formatNamaPaparan(item.daerah)} · {item.saizKebun || 0} ekar · {(item.jumlahPokok || 0).toLocaleString()} pokok</p>
                              {item.assignedNama && <p className="mt-0.5 text-[8px] text-gray-400">Pegawai: {formatNamaPaparan(item.assignedNama)}</p>}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[9px] font-bold text-gold">{mt.toFixed(2)} MT</span>
                              <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold ${gps ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                {gps ? '📍 GPS' : 'GPS Belum Ada'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
