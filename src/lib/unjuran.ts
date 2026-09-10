import { STAGES, VARIETIES } from '@/lib/constants';

const MS_SEHARI = 86_400_000;
export const AMBANG_PEMANTAUAN_HARI = 30;
export const AMBANG_HAMPIR_PEMANTAUAN_HARI = 20;

export interface InputPeringkatLawatan {
  pct?: number;
  d?: number;
}

export interface InputVarietiLawatan {
  key?: string;
  name?: string;
  pokok?: number;
  kg?: number;
}

export interface InputUnjuranLawatan {
  id?: string;
  kebunId: string;
  tarikhLawatan?: string;
  totalKg?: number;
  stages?: Record<string, InputPeringkatLawatan>;
  varietiResults?: InputVarietiLawatan[];
}

export type StatusPemantauan = 'tiada' | 'tidak_sah' | 'masa_hadapan' | 'semasa' | 'hampir' | 'lewat';

export interface PemantauanLive {
  status: StatusPemantauan;
  hariSejakLawatan: number | null;
  hariLewat: number;
  label: string;
}

export interface BatchUnjuran {
  stageKey: string;
  stageName: string;
  pct: number;
  kg: number;
  dAsal: number;
  dLive: number | null;
  bakiHari: number | null;
  tarikhJangkaan: string;
  bulan: string;
  bulanSort: number;
  sasaranBerlalu: boolean;
}

export interface PecahanVarietiNormal {
  key: string;
  name: string;
  pokok: number;
  kg: number;
}

export interface UnjuranLawatan<T extends InputUnjuranLawatan = InputUnjuranLawatan> {
  rekod: T;
  tarikhSemasa: string;
  totalKg: number;
  pemantauan: PemantauanLive;
  batches: BatchUnjuran[];
  varieti: PecahanVarietiNormal[];
}

function nomborBukanNegatif(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function tarikhUtc(tarikh?: string): number | null {
  if (!tarikh) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tarikh);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? ms
    : null;
}

export function tarikhMalaysia(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function tambahHari(tarikh: string, hari: number): string {
  const base = tarikhUtc(tarikh);
  if (base === null) return '';
  return new Date(base + Math.round(hari) * MS_SEHARI).toISOString().slice(0, 10);
}

export function bezaHari(tarikhAkhir: string, tarikhAwal: string): number | null {
  const akhir = tarikhUtc(tarikhAkhir);
  const awal = tarikhUtc(tarikhAwal);
  if (akhir === null || awal === null) return null;
  return Math.round((akhir - awal) / MS_SEHARI);
}

export function formatTarikhBM(tarikh: string): string {
  const ms = tarikhUtc(tarikh);
  if (ms === null) return '-';
  return new Intl.DateTimeFormat('ms-MY', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(ms));
}

export function formatBulanBM(tarikh: string): string {
  const ms = tarikhUtc(tarikh);
  if (ms === null) return '-';
  return new Intl.DateTimeFormat('ms-MY', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(new Date(ms));
}

function bulanSort(tarikh: string): number {
  const ms = tarikhUtc(tarikh);
  if (ms === null) return 0;
  const date = new Date(ms);
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function statusPemantauan(tarikhLawatan: string | undefined, tarikhSemasa: string): PemantauanLive {
  if (!tarikhLawatan) {
    return { status: 'tiada', hariSejakLawatan: null, hariLewat: 0, label: 'Belum pernah dipantau' };
  }
  const hari = bezaHari(tarikhSemasa, tarikhLawatan);
  if (hari === null) {
    return { status: 'tidak_sah', hariSejakLawatan: null, hariLewat: 0, label: 'Tarikh lawatan tidak sah' };
  }
  if (hari < 0) {
    return { status: 'masa_hadapan', hariSejakLawatan: hari, hariLewat: 0, label: 'Tarikh lawatan di masa hadapan' };
  }
  if (hari <= AMBANG_HAMPIR_PEMANTAUAN_HARI) {
    return { status: 'semasa', hariSejakLawatan: hari, hariLewat: 0, label: `${hari} hari sejak pemantauan` };
  }
  if (hari <= AMBANG_PEMANTAUAN_HARI) {
    return { status: 'hampir', hariSejakLawatan: hari, hariLewat: 0, label: `Pemantauan semula dalam ${AMBANG_PEMANTAUAN_HARI - hari} hari` };
  }
  const hariLewat = hari - AMBANG_PEMANTAUAN_HARI;
  return { status: 'lewat', hariSejakLawatan: hari, hariLewat, label: `Lewat pemantauan ${hariLewat} hari` };
}

function namaVarieti(key?: string, name?: string): { key: string; name: string } {
  const rawKey = (key || '').trim();
  const rawName = (name || '').trim();
  const ref = VARIETIES.find(item =>
    item.key === rawKey
    || item.key === rawName
    || item.name.toLowerCase() === rawName.toLowerCase()
  );
  return {
    key: ref?.key || rawKey || rawName.toLowerCase() || 'belum-diperincikan',
    name: ref?.name || rawName || rawKey || 'Belum Diperincikan',
  };
}

export function normalisasiVarieti(
  varietiResults: InputVarietiLawatan[] | undefined,
  totalKgInput: number
): PecahanVarietiNormal[] {
  const totalKg = nomborBukanNegatif(totalKgInput);
  const pecahan = (varietiResults || [])
    .map(item => ({ ...namaVarieti(item.key, item.name), pokok: nomborBukanNegatif(item.pokok), kg: nomborBukanNegatif(item.kg) }))
    .filter(item => item.kg > 0);
  const jumlahAsal = pecahan.reduce((sum, item) => sum + item.kg, 0);
  if (jumlahAsal <= 0 || totalKg <= 0) return [];

  const faktor = totalKg / jumlahAsal;
  const map = new Map<string, PecahanVarietiNormal>();
  pecahan.forEach(item => {
    const semasa = map.get(item.name) || { key: item.key, name: item.name, pokok: 0, kg: 0 };
    semasa.pokok += item.pokok;
    semasa.kg += item.kg * faktor;
    map.set(item.name, semasa);
  });
  return Array.from(map.values()).sort((a, b) => b.kg - a.kg);
}

export function unjurLawatan<T extends InputUnjuranLawatan>(
  rekod: T,
  tarikhSemasa = tarikhMalaysia()
): UnjuranLawatan<T> {
  const totalKg = nomborBukanNegatif(rekod.totalKg);
  const pemantauan = statusPemantauan(rekod.tarikhLawatan, tarikhSemasa);
  const hariSejakLawatan = pemantauan.hariSejakLawatan;
  const tarikhLawatanSah = tarikhUtc(rekod.tarikhLawatan) !== null;

  const inputs = rekod.stages || {};
  const producingPct = STAGES.reduce((sum, stage) => {
    if (stage.J === null) return sum;
    return sum + Math.min(100, nomborBukanNegatif(inputs[stage.key]?.pct));
  }, 0);

  const batches: BatchUnjuran[] = STAGES.flatMap(stage => {
    if (stage.J === null || !tarikhLawatanSah) return [];
    const input = inputs[stage.key];
    const pct = Math.min(100, nomborBukanNegatif(input?.pct));
    if (pct <= 0 || producingPct <= 0) return [];
    const dAsal = nomborBukanNegatif(input?.d);
    const tarikhJangkaan = tambahHari(rekod.tarikhLawatan || '', stage.J - dAsal);
    const dLive = hariSejakLawatan === null ? null : dAsal + hariSejakLawatan;
    const bakiHari = dLive === null ? null : stage.J - dLive;
    return [{
      stageKey: stage.key,
      stageName: stage.name,
      pct,
      kg: totalKg * (pct / producingPct),
      dAsal,
      dLive,
      bakiHari,
      tarikhJangkaan,
      bulan: formatBulanBM(tarikhJangkaan),
      bulanSort: bulanSort(tarikhJangkaan),
      sasaranBerlalu: bakiHari !== null && bakiHari < 0,
    }];
  });

  return {
    rekod,
    tarikhSemasa,
    totalKg,
    pemantauan,
    batches,
    varieti: normalisasiVarieti(rekod.varietiResults, totalKg),
  };
}
