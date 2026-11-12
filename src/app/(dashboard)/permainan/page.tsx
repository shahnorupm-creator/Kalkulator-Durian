'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import PokokSvg from '@/components/permainan/PokokSvg';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { db } from '@/lib/firebase';
import { STAGES, formatNamaPaparan } from '@/lib/constants';
import { formatTarikhBM } from '@/lib/unjuran';
import { useTarikhSemasa } from '@/lib/useTarikhSemasa';
import {
  SENARAI_LENCANA,
  binaKebunMaya,
  cadangMisi,
  lawatanSemasaMengikutKebun,
  ringkasPermainan,
  type JenisMisi,
  type KebunMaya,
  type KunciFasa,
  type KunciLencana,
  type LawatanPermainan,
} from '@/lib/permainan/kebunMaya';

// Halaman ini BACA SAHAJA. Ia tidak menulis apa-apa ke Firestore dan tidak
// mengubah struktur data. Skop kebun mengikut peranan, sama seperti Kalkulator
// dan Peta Negeri.

interface KebunPermainan {
  id: string;
  nama: string;
  negeri?: string;
  daerah?: string;
  assignedTo?: string;
}

const NAMA_FASA = Object.fromEntries(STAGES.map(s => [s.key, s.name])) as Record<KunciFasa, string>;

const IKON_LENCANA: Record<KunciLencana, string> = {
  gambar: '📷',
  lokasi: '📍',
  tepatMasa: '⏱️',
  terkini: '🔄',
};

interface Teks {
  tajuk: string;
  subtajuk: string;
  kebun: string;
  dipantau: string;
  lencana: string;
  perluTindakan: string;
  memuat: string;
  ralat: string;
  kosong: string;
  kosongInfo: string;
  belumDipantau: string;
  fasaDominan: string;
  gugur: string;
  hari: string;
  gugurBerlalu: string;
  lawatanTerakhir: string;
  hariLalu: string;
  legenda: string;
  bukaKalkulator: string;
  semuaLencana: string;
  diperoleh: string;
  belumDiperoleh: string;
  nota: string;
  tahap: string[];
  nama: Record<KunciLencana, string>;
  petunjuk: Record<KunciLencana, string>;
  misi: (jenis: JenisMisi, hari: number | null) => string;
}

const BM: Teks = {
  tajuk: 'Kebun Maya',
  subtajuk: 'Lihat kebun anda membesar mengikut rekod lawatan sebenar.',
  kebun: 'Kebun',
  dipantau: 'Dipantau',
  lencana: 'Lencana',
  perluTindakan: 'Perlu tindakan',
  memuat: 'Memuatkan kebun...',
  ralat: 'Kebun tidak dapat dimuatkan. Sila cuba semula.',
  kosong: 'Belum ada kebun untuk dipaparkan.',
  kosongInfo: 'Kebun yang di-assign kepada anda akan muncul di sini.',
  belumDipantau: 'Belum dipantau',
  fasaDominan: 'Fasa dominan',
  gugur: 'Jangkaan gugur terdekat',
  hari: 'hari',
  gugurBerlalu: 'Tarikh jangkaan gugur telah berlalu. Sila kemas kini lawatan.',
  lawatanTerakhir: 'Lawatan terakhir',
  hariLalu: 'hari lalu',
  legenda: 'Setiap pokok mewakili 10% pokok dalam kebun.',
  bukaKalkulator: 'Buka Kalkulator',
  semuaLencana: 'Semua lencana diperoleh. Teruskan pemantauan berkala.',
  diperoleh: 'diperoleh',
  belumDiperoleh: 'belum diperoleh',
  nota:
    'Paparan ini membaca rekod lawatan sedia ada dan tidak mengubah sebarang data. Lencana diberi untuk ketepatan dan kelengkapan rekod, bukan bilangan lawatan.',
  tahap: ['Benih', 'Tunas', 'Pokok Muda', 'Pokok Berbuah', 'Kebun Cemerlang'],
  nama: {
    gambar: 'Gambar Lengkap',
    lokasi: 'Lokasi Disahkan',
    tepatMasa: 'Tepat Masa',
    terkini: 'Pemantauan Terkini',
  },
  petunjuk: {
    gambar: 'Lawatan terakhir mempunyai 5 gambar bukti.',
    lokasi: 'Pegawai berada dalam radius kebun semasa lawatan terakhir.',
    tepatMasa: 'Rekod terakhir disimpan dalam 3 hari selepas tarikh lawatan.',
    terkini: 'Lawatan terakhir dalam tempoh pemantauan semasa.',
  },
  misi: (jenis, hari) => {
    switch (jenis) {
      case 'lawatanPertama':
        return 'Buat lawatan pertama untuk menumbuhkan kebun ini.';
      case 'kemaskini':
        return hari !== null
          ? `Lawatan terakhir ${hari} hari lalu. Kemas kini rekod pemantauan.`
          : 'Kemas kini rekod pemantauan.';
      case 'gambar':
        return 'Pada rekod seterusnya, lengkapkan 5 gambar bukti lawatan.';
      case 'lokasi':
        return 'Pada rekod seterusnya, simpan rekod semasa berada di dalam kebun.';
      case 'tepatMasa':
        return 'Pada rekod seterusnya, simpan rekod pada hari lawatan.';
    }
  },
};

const EN: Teks = {
  tajuk: 'Virtual Orchard',
  subtajuk: 'Watch your orchards grow according to your actual visit records.',
  kebun: 'Orchards',
  dipantau: 'Monitored',
  lencana: 'Badges',
  perluTindakan: 'Needs action',
  memuat: 'Loading orchards...',
  ralat: 'Orchards could not be loaded. Please try again.',
  kosong: 'No orchards to display yet.',
  kosongInfo: 'Orchards assigned to you will appear here.',
  belumDipantau: 'Not monitored',
  fasaDominan: 'Dominant stage',
  gugur: 'Nearest expected drop',
  hari: 'days',
  gugurBerlalu: 'The expected drop date has passed. Please update the visit.',
  lawatanTerakhir: 'Last visit',
  hariLalu: 'days ago',
  legenda: 'Each tree represents 10% of the trees in the orchard.',
  bukaKalkulator: 'Open Calculator',
  semuaLencana: 'All badges earned. Keep monitoring regularly.',
  diperoleh: 'earned',
  belumDiperoleh: 'not earned yet',
  nota:
    'This view reads existing visit records and changes no data. Badges reward accurate and complete records, not the number of visits.',
  tahap: ['Seed', 'Sprout', 'Young Tree', 'Fruiting Tree', 'Outstanding Orchard'],
  nama: {
    gambar: 'Photos Complete',
    lokasi: 'Location Verified',
    tepatMasa: 'On Time',
    terkini: 'Up to Date',
  },
  petunjuk: {
    gambar: 'The latest visit has 5 evidence photos.',
    lokasi: 'The officer was within the orchard radius during the latest visit.',
    tepatMasa: 'The latest record was saved within 3 days of the visit date.',
    terkini: 'The latest visit is within the current monitoring period.',
  },
  misi: (jenis, hari) => {
    switch (jenis) {
      case 'lawatanPertama':
        return 'Make the first visit to grow this orchard.';
      case 'kemaskini':
        return hari !== null
          ? `Last visit was ${hari} days ago. Update the monitoring record.`
          : 'Update the monitoring record.';
      case 'gambar':
        return 'On the next record, complete the 5 evidence photos.';
      case 'lokasi':
        return 'On the next record, save it while inside the orchard.';
      case 'tepatMasa':
        return 'On the next record, save it on the day of the visit.';
    }
  },
};

function KadKebun({
  kebun,
  maya,
  t,
  indeks,
}: {
  kebun: KebunPermainan;
  maya: KebunMaya;
  t: Teks;
  indeks: number;
}) {
  const lokasi = [kebun.daerah, kebun.negeri].filter(Boolean).join(', ');
  const ringkasFasa = maya.pecahanFasa
    .map(f => `${NAMA_FASA[f.key]} ${Math.round(f.pct)}%`)
    .join(', ');
  const misi = cadangMisi(maya);

  return (
    <article className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-bold text-forest-dark">{formatNamaPaparan(kebun.nama)}</h2>
          {lokasi && <p className="mt-0.5 truncate text-[11px] text-gray-500">{lokasi}</p>}
        </div>
        <span className="flex-shrink-0 rounded-full bg-forest/10 px-2.5 py-1 text-[10px] font-bold text-forest">
          {t.tahap[maya.tahap]}
        </span>
      </header>

      {/* Kebun maya: 10 pokok = 100% pokok, mengikut peratus fasa daripada lawatan terkini */}
      <div className="mt-3 rounded-xl bg-cream p-3">
        {maya.adaLawatan ? (
          <>
            <div role="img" aria-label={ringkasFasa} className="grid grid-cols-5 gap-x-2 gap-y-1">
              {maya.slot.map((fasa, i) => (
                <PokokSvg key={i} fasa={fasa} label={NAMA_FASA[fasa]} kelewatan={((i + indeks) % 5) * 0.6} />
              ))}
            </div>
            <p className="mt-2 text-center text-[10px] text-gray-500">{t.legenda}</p>
            <ul className="mt-2 flex flex-wrap justify-center gap-1.5">
              {maya.pecahanFasa.map(f => (
                <li
                  key={f.key}
                  className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700"
                >
                  {NAMA_FASA[f.key]} {Math.round(f.pct)}%
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-6 text-center text-xs font-semibold text-gray-400">{t.belumDipantau}</p>
        )}
      </div>

      {maya.adaLawatan && (
        <div className="mt-3 space-y-0.5 text-[11px] text-gray-600">
          {maya.fasaDominan && (
            <p>
              {t.fasaDominan}: <span className="font-bold text-forest-dark">{NAMA_FASA[maya.fasaDominan]}</span>
            </p>
          )}
          {maya.bakiHariTerdekat !== null ? (
            <p>
              {t.gugur}: <span className="font-bold text-forest-dark">{maya.bakiHariTerdekat} {t.hari}</span>
            </p>
          ) : maya.sasaranBerlalu ? (
            <p className="font-semibold text-amber-700">{t.gugurBerlalu}</p>
          ) : null}
          {maya.tarikhLawatan && (
            <p>
              {t.lawatanTerakhir}: {formatTarikhBM(maya.tarikhLawatan)}
              {maya.hariSejakLawatan !== null && ` (${maya.hariSejakLawatan} ${t.hariLalu})`}
            </p>
          )}
        </div>
      )}

      {/* Lencana: ketepatan dan kelengkapan rekod sahaja */}
      <ul className="mt-3 grid grid-cols-2 gap-1.5">
        {SENARAI_LENCANA.map(kunci => {
          const dapat = maya.lencana[kunci];
          return (
            <li
              key={kunci}
              title={t.petunjuk[kunci]}
              aria-label={`${t.nama[kunci]}: ${dapat ? t.diperoleh : t.belumDiperoleh}`}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[10px] font-bold ${
                dapat
                  ? 'border-fama-lime/60 bg-fama-lime/15 text-forest'
                  : 'border-gray-200 bg-gray-50 text-gray-400'
              }`}
            >
              <span aria-hidden="true" className={dapat ? '' : 'opacity-40 grayscale'}>
                {IKON_LENCANA[kunci]}
              </span>
              <span className="truncate">{t.nama[kunci]}</span>
              <span aria-hidden="true" className="ml-auto">{dapat ? '✓' : ''}</span>
            </li>
          );
        })}
      </ul>

      {misi ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-[11px] font-semibold text-amber-800">{t.misi(misi, maya.hariSejakLawatan)}</p>
          <Link
            href="/kalkulator"
            className="flex-shrink-0 rounded-lg bg-forest px-3 py-1.5 text-[10px] font-bold text-white transition hover:bg-moss"
          >
            {t.bukaKalkulator}
          </Link>
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-fama-lime/15 px-3 py-2 text-[11px] font-semibold text-forest">
          {t.semuaLencana}
        </p>
      )}
    </article>
  );
}

export default function PermainanPage() {
  const { user, profile, isSuperAdmin, loading: authLoading, hasPageAccess } = useAuth();
  const { locale } = useLanguage();
  const t = locale === 'bm' ? BM : EN;
  const router = useRouter();
  const tarikhSemasa = useTarikhSemasa();

  const [kebun, setKebun] = useState<KebunPermainan[]>([]);
  const [lawatan, setLawatan] = useState<LawatanPermainan[]>([]);
  const [loading, setLoading] = useState(true);
  const [lawatanDimuat, setLawatanDimuat] = useState(false);
  const [ralat, setRalat] = useState(false);

  const role = profile?.role;
  const nasional = isSuperAdmin || role === 'admin_hq';
  const userNegeri = profile?.negeri?.trim() || '';
  const bolehAkses = hasPageAccess('permainan');

  useEffect(() => {
    if (!authLoading && profile && !bolehAkses) router.replace('/');
  }, [authLoading, profile, bolehAkses, router]);

  // Muat kebun mengikut skop peranan (corak sama seperti Kalkulator dan Peta Negeri).
  useEffect(() => {
    if (!user || !profile || !bolehAkses) {
      setKebun([]);
      setLoading(false);
      return;
    }
    if (role === 'admin_negeri' && !userNegeri) {
      setKebun([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setRalat(false);
    let q;
    if (nasional) {
      q = query(collection(db, 'kebun'), orderBy('nama'));
    } else if (role === 'admin_negeri') {
      q = query(collection(db, 'kebun'), where('negeri', '==', userNegeri));
    } else {
      q = query(collection(db, 'kebun'), where('assignedTo', '==', user.uid), orderBy('nama'));
    }

    const unsubscribe = onSnapshot(
      q,
      snapshot => {
        setKebun(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KebunPermainan)));
        setLoading(false);
      },
      error => {
        console.error('Gagal memuatkan Kebun Maya:', error);
        setRalat(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user, profile, bolehAkses, nasional, role, userNegeri]);

  // Muat rekod lawatan setiap kebun. Kemas kini masa nyata: bila pegawai simpan
  // lawatan baharu, kebun maya berubah tanpa muat semula.
  useEffect(() => {
    setLawatan([]);
    setLawatanDimuat(false);
    if (kebun.length === 0) return;

    const rekodMengikutKebun = new Map<string, LawatanPermainan[]>();
    let aktif = true;
    const terbit = () => {
      if (!aktif) return;
      setLawatan(Array.from(rekodMengikutKebun.values()).flat());
      if (rekodMengikutKebun.size >= kebun.length) setLawatanDimuat(true);
    };

    const unsubs = kebun.map(k =>
      onSnapshot(
        query(collection(db, 'kebun', k.id, 'lawatan')),
        snap => {
          rekodMengikutKebun.set(
            k.id,
            snap.docs.map(
              d => ({ ...(d.data() as Omit<LawatanPermainan, 'id' | 'kebunId'>), id: d.id, kebunId: k.id } as LawatanPermainan)
            )
          );
          terbit();
        },
        error => {
          console.warn('Lawatan kebun tidak dapat dimuatkan:', k.id, error);
          rekodMengikutKebun.set(k.id, []);
          terbit();
        }
      )
    );
    return () => {
      aktif = false;
      unsubs.forEach(u => u());
    };
  }, [kebun]);

  const senarai = useMemo(() => {
    const idSah = new Set(kebun.map(k => k.id));
    const semasa = lawatanSemasaMengikutKebun(lawatan, idSah);
    return kebun.map(k => ({ kebun: k, maya: binaKebunMaya(k.id, semasa.get(k.id), tarikhSemasa) }));
  }, [kebun, lawatan, tarikhSemasa]);

  const ringkasan = useMemo(() => ringkasPermainan(senarai.map(s => s.maya)), [senarai]);
  const bilPerluTindakan = useMemo(
    () => senarai.filter(s => cadangMisi(s.maya) !== null).length,
    [senarai]
  );

  if (profile && !bolehAkses) return null;

  const memuat = loading || (kebun.length > 0 && !lawatanDimuat);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-extrabold text-forest-dark">
          <span aria-hidden="true">🎮</span>
          {t.tajuk}
        </h1>
        <p className="mt-1 text-xs text-gray-500">{t.subtajuk}</p>
      </header>

      {ralat && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {t.ralat}
        </div>
      )}

      {memuat && !ralat ? (
        <div className="space-y-3" aria-live="polite" aria-busy="true">
          <p className="text-xs text-gray-400">{t.memuat}</p>
          <div className="h-28 animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none" />
          <div className="h-64 animate-pulse rounded-2xl bg-gray-100 motion-reduce:animate-none" />
        </div>
      ) : kebun.length === 0 && !ralat ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-bold text-forest-dark">{t.kosong}</p>
          <p className="mt-1 text-xs text-gray-500">{t.kosongInfo}</p>
        </div>
      ) : (
        <>
          <section aria-label={t.tajuk} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: t.kebun, nilai: String(ringkasan.jumlahKebun) },
              { label: t.dipantau, nilai: `${ringkasan.dipantau}/${ringkasan.jumlahKebun}` },
              { label: t.lencana, nilai: `${ringkasan.lencanaDiperoleh}/${ringkasan.lencanaMaksimum}` },
              { label: t.perluTindakan, nilai: String(bilPerluTindakan) },
            ].map(item => (
              <div key={item.label} className="rounded-xl border border-gray-100 bg-white px-3 py-2.5 text-center shadow-sm">
                <p className="text-lg font-extrabold text-forest-dark">{item.nilai}</p>
                <p className="text-[10px] font-semibold text-gray-500">{item.label}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            {senarai.map((item, indeks) => (
              <KadKebun key={item.kebun.id} kebun={item.kebun} maya={item.maya} t={t} indeks={indeks} />
            ))}
          </section>

          <p className="text-center text-[10px] leading-relaxed text-gray-400">{t.nota}</p>
        </>
      )}
    </div>
  );
}
