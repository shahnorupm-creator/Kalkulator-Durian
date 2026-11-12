import { BIL_GAMBAR_WAJIB, STAGES } from '@/lib/constants';
import {
  kesanBackdate,
  pilihLawatanSemasaPerKebun,
  type LawatanSemasaBase,
} from '@/lib/lawatan';
import {
  unjurLawatan,
  type InputUnjuranLawatan,
  type StatusPemantauan,
} from '@/lib/unjuran';

// ─────────────────────────────────────────────────────────────────────────────
// Logik "Kebun Maya": menukar rekod lawatan sedia ada kepada paparan permainan.
//
// PRINSIP:
// - Fungsi tulen, BACA SAHAJA. Tiada akses Firestore dan tiada tulis di sini.
// - Tiada formula baharu. Anggaran hari/fasa datang daripada unjurLawatan().
// - Ganjaran (lencana) hanya untuk KETEPATAN dan KELENGKAPAN rekod, bukan
//   bilangan lawatan atau kelajuan, supaya tidak menggalakkan rekod palsu.
// ─────────────────────────────────────────────────────────────────────────────

export type KunciFasa = (typeof STAGES)[number]['key'];

/** Urutan fasa mengikut kitaran hidup, dibaca daripada STAGES (tiada senarai kedua). */
export const URUTAN_FASA: KunciFasa[] = STAGES.map(s => s.key);

/** Bilangan pokok yang dipaparkan dalam satu kebun maya (setiap pokok = 10%). */
export const BILANGAN_SLOT = 10;

/** Toleransi (hari) bagi tarikh lawatan yang sedikit mendahului masa rekod disimpan. */
const TOLERANSI_MASA_HADAPAN_HARI = 1;

/** Rekod lawatan seperti yang disimpan sedia ada. Medan tambahan hanya dibaca. */
export interface LawatanPermainan extends LawatanSemasaBase, InputUnjuranLawatan {
  statusLokasi?: string;
  gambar?: unknown[];
}

export type KunciLencana = 'gambar' | 'lokasi' | 'tepatMasa' | 'terkini';
export const SENARAI_LENCANA: KunciLencana[] = ['gambar', 'lokasi', 'tepatMasa', 'terkini'];

export type TahapKebun = 0 | 1 | 2 | 3 | 4;

export interface KebunMaya {
  kebunId: string;
  adaLawatan: boolean;
  /** Fasa bagi setiap pokok yang dipaparkan, tersusun mengikut kitaran hidup. */
  slot: KunciFasa[];
  fasaDominan: KunciFasa | null;
  /** Peratus pokok bagi setiap fasa yang ada nilai (daripada rekod lawatan). */
  pecahanFasa: { key: KunciFasa; pct: number }[];
  /** Baki hari ke tarikh gugur terdekat yang belum berlalu (null jika tiada). */
  bakiHariTerdekat: number | null;
  /** Sekurang-kurangnya satu kumpulan sudah melepasi tarikh jangkaan gugur. */
  sasaranBerlalu: boolean;
  tarikhLawatan?: string;
  hariSejakLawatan: number | null;
  statusPemantauan: StatusPemantauan;
  lencana: Record<KunciLencana, boolean>;
  bilLencana: number;
  tahap: TahapKebun;
}

export type JenisMisi = 'lawatanPertama' | 'kemaskini' | 'gambar' | 'lokasi' | 'tepatMasa';

export interface RingkasanPermainan {
  jumlahKebun: number;
  dipantau: number;
  lencanaDiperoleh: number;
  lencanaMaksimum: number;
  kebunCemerlang: number;
}

function peratusFasa(stages: LawatanPermainan['stages'], key: KunciFasa): number {
  const nilai = Number(stages?.[key]?.pct);
  return Number.isFinite(nilai) && nilai > 0 ? nilai : 0;
}

/**
 * Agih sejumlah slot pokok mengikut peratus pokok bagi setiap fasa
 * (kaedah baki terbesar supaya jumlah sentiasa tepat). Susunan mengikut kitaran hidup.
 */
export function agihSlot(
  stages: LawatanPermainan['stages'],
  jumlahSlot: number = BILANGAN_SLOT
): KunciFasa[] {
  const nilai = URUTAN_FASA.map(key => ({ key, pct: peratusFasa(stages, key) }));
  const jumlah = nilai.reduce((s, n) => s + n.pct, 0);
  if (jumlah <= 0) return [];

  const bahagian = nilai.map(n => {
    const tepat = (n.pct / jumlah) * jumlahSlot;
    const asas = Math.floor(tepat);
    return { key: n.key, asas, baki: tepat - asas };
  });

  let lebihan = jumlahSlot - bahagian.reduce((s, b) => s + b.asas, 0);
  [...bahagian]
    .sort((a, b) => b.baki - a.baki)
    .forEach(b => {
      if (lebihan > 0) {
        b.asas += 1;
        lebihan -= 1;
      }
    });

  return bahagian.flatMap(b => Array.from({ length: b.asas }, () => b.key));
}

/** Fasa berbuah dengan peratus tertinggi. "Tidak Berbuah" tidak dikira dominan. */
export function fasaDominan(stages: LawatanPermainan['stages']): KunciFasa | null {
  let terbaik: KunciFasa | null = null;
  let pctTerbaik = 0;
  STAGES.forEach(stage => {
    if (stage.J === null) return;
    const pct = peratusFasa(stages, stage.key);
    if (pct > pctTerbaik) {
      pctTerbaik = pct;
      terbaik = stage.key;
    }
  });
  return terbaik;
}

/** Pilih satu lawatan semasa bagi setiap kebun (menggunakan peraturan sedia ada). */
export function lawatanSemasaMengikutKebun(
  rekod: LawatanPermainan[],
  idSah: Set<string>
): Map<string, LawatanPermainan> {
  const map = new Map<string, LawatanPermainan>();
  pilihLawatanSemasaPerKebun(rekod, idSah).forEach(item => map.set(item.kebunId, item));
  return map;
}

const TIADA_LENCANA: Record<KunciLencana, boolean> = {
  gambar: false,
  lokasi: false,
  tepatMasa: false,
  terkini: false,
};

/** Bina keadaan kebun maya daripada lawatan semasa kebun (atau tiada lawatan). */
export function binaKebunMaya(
  kebunId: string,
  lawatan: LawatanPermainan | undefined,
  tarikhSemasa: string
): KebunMaya {
  if (!lawatan) {
    return {
      kebunId,
      adaLawatan: false,
      slot: [],
      fasaDominan: null,
      pecahanFasa: [],
      bakiHariTerdekat: null,
      sasaranBerlalu: false,
      hariSejakLawatan: null,
      statusPemantauan: 'tiada',
      lencana: { ...TIADA_LENCANA },
      bilLencana: 0,
      tahap: 0,
    };
  }

  const unjuran = unjurLawatan(lawatan, tarikhSemasa);

  const bakiSemua = unjuran.batches
    .map(b => b.bakiHari)
    .filter((b): b is number => b !== null);
  const bakiBelumLepas = bakiSemua.filter(b => b >= 0);

  // "Tepat Masa": rekod disimpan 0-3 hari selepas tarikh lawatan. kesanBackdate
  // menganggap jurang NEGATIF (tarikh lawatan di masa hadapan berbanding masa rekod
  // disimpan) sebagai normal, jadi lencana ini menolaknya secara berasingan. Toleransi
  // 1 hari untuk beza zon masa antara peranti dan pelayan.
  const backdate = kesanBackdate(lawatan.tarikhLawatan, lawatan.createdAt?.seconds ?? null);
  const tepatMasa =
    backdate.status === 'normal' &&
    backdate.hariJurang !== null &&
    backdate.hariJurang >= -TOLERANSI_MASA_HADAPAN_HARI;

  const lencana: Record<KunciLencana, boolean> = {
    gambar: (lawatan.gambar?.length ?? 0) >= BIL_GAMBAR_WAJIB,
    lokasi: lawatan.statusLokasi === 'disahkan',
    tepatMasa,
    terkini: unjuran.pemantauan.status === 'semasa',
  };
  const bilLencana = SENARAI_LENCANA.filter(k => lencana[k]).length;

  return {
    kebunId,
    adaLawatan: true,
    slot: agihSlot(lawatan.stages),
    fasaDominan: fasaDominan(lawatan.stages),
    pecahanFasa: URUTAN_FASA
      .map(key => ({ key, pct: peratusFasa(lawatan.stages, key) }))
      .filter(f => f.pct > 0),
    bakiHariTerdekat: bakiBelumLepas.length > 0 ? Math.min(...bakiBelumLepas) : null,
    sasaranBerlalu: bakiSemua.some(b => b < 0),
    tarikhLawatan: lawatan.tarikhLawatan,
    hariSejakLawatan: unjuran.pemantauan.hariSejakLawatan,
    statusPemantauan: unjuran.pemantauan.status,
    lencana,
    bilLencana,
    tahap: bilLencana as TahapKebun,
  };
}

/**
 * Misi seterusnya bagi satu kebun. Semua misi dipenuhi dengan membuat satu rekod
 * lawatan baharu yang benar. Tiada misi yang memberi ganjaran kepada kelajuan atau
 * bilangan rekod.
 */
export function cadangMisi(kebun: KebunMaya): JenisMisi | null {
  if (!kebun.adaLawatan) return 'lawatanPertama';
  if (!kebun.lencana.terkini) return 'kemaskini';
  if (!kebun.lencana.gambar) return 'gambar';
  if (!kebun.lencana.lokasi) return 'lokasi';
  if (!kebun.lencana.tepatMasa) return 'tepatMasa';
  return null;
}

export function ringkasPermainan(senarai: KebunMaya[]): RingkasanPermainan {
  return {
    jumlahKebun: senarai.length,
    dipantau: senarai.filter(k => k.adaLawatan).length,
    lencanaDiperoleh: senarai.reduce((s, k) => s + k.bilLencana, 0),
    lencanaMaksimum: senarai.length * SENARAI_LENCANA.length,
    kebunCemerlang: senarai.filter(k => k.bilLencana === SENARAI_LENCANA.length).length,
  };
}
