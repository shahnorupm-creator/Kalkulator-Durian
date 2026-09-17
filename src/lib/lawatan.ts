export interface LawatanSemasaBase {
  id?: string;
  kebunId: string;
  tarikhLawatan?: string;
  createdAt?: { seconds?: number } | null;
  updatedAt?: { seconds?: number } | null;
}

function tarikhLawatanMs(tarikh?: string): number {
  if (!tarikh) return 0;
  const parsed = Date.parse(`${tarikh}T00:00:00`);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function kemasKiniMs(rekod: LawatanSemasaBase): number {
  const seconds = rekod.updatedAt?.seconds ?? rekod.createdAt?.seconds ?? 0;
  return Number(seconds) * 1000;
}

/**
 * Banding dua rekod lawatan.
 * Keutamaan: rekod yang PALING BAHARU DISIMPAN dianggap rekod lawatan terakhir,
 * kemudian tarikh pemantauan sebagai pemutus seri. Ini kerana pemantauan terakhir
 * yang dimasukkan pegawai ialah maklumat terkini, walaupun tarikh lawatannya lebih awal.
 */
export function bandingLawatanSemasa(
  a: LawatanSemasaBase,
  b: LawatanSemasaBase
): number {
  const bezaKemasKini = kemasKiniMs(a) - kemasKiniMs(b);
  if (bezaKemasKini !== 0) return bezaKemasKini;

  const bezaTarikh = tarikhLawatanMs(a.tarikhLawatan) - tarikhLawatanMs(b.tarikhLawatan);
  if (bezaTarikh !== 0) return bezaTarikh;

  // Pemutus seri deterministik jika timestamp sama.
  return (a.id || '').localeCompare(b.id || '');
}

/**
 * Pilih satu rekod pemantauan semasa bagi setiap kebun.
 * Rekod lama kekal dalam Firestore sebagai sejarah tetapi tidak dijumlahkan.
 */
export function pilihLawatanSemasaPerKebun<T extends LawatanSemasaBase>(
  rekod: T[],
  kebunSah?: Set<string>
): T[] {
  const map = new Map<string, T>();

  rekod.forEach(item => {
    if (!item.kebunId || (kebunSah && !kebunSah.has(item.kebunId))) return;
    const semasa = map.get(item.kebunId);
    if (!semasa || bandingLawatanSemasa(item, semasa) > 0) {
      map.set(item.kebunId, item);
    }
  });

  return Array.from(map.values());
}

// ── Kesan "direkod lewat" (backdate) ─────────────────────────────────────────
// Backdate dikesan dengan membandingkan tarikhLawatan (diisi manual oleh pegawai)
// dengan createdAt (cap masa server sebenar semasa rekod disimpan).
// Jurang kecil adalah normal (perjalanan balik/offline sync); jurang besar
// menandakan rekod mungkin diisi belakang tarikh dan patut disemak admin.
export const AMBANG_BACKDATE_NORMAL_HARI = 3;   // 0-3 hari: normal
export const AMBANG_BACKDATE_LEWAT_HARI = 14;   // 4-14 hari: lewat sikit; >14: backdate ketara

export type StatusBackdate = 'tiada' | 'normal' | 'lewat' | 'backdate';

export interface KesanBackdate {
  status: StatusBackdate;
  hariJurang: number | null; // bilangan hari createdAt melebihi tarikhLawatan
  label: string;
}

/**
 * Kira jurang antara tarikh lawatan (manual) dan masa rekod disimpan (server).
 * @param tarikhLawatan tarikh yang diisi pegawai (YYYY-MM-DD)
 * @param createdAtSeconds cap masa server dalam saat (Firestore Timestamp.seconds)
 */
export function kesanBackdate(
  tarikhLawatan: string | undefined,
  createdAtSeconds: number | null | undefined
): KesanBackdate {
  if (!tarikhLawatan || !createdAtSeconds) {
    return { status: 'tiada', hariJurang: null, label: '' };
  }
  const lawatanMs = tarikhLawatanMs(tarikhLawatan);
  if (!lawatanMs) return { status: 'tiada', hariJurang: null, label: '' };

  const createdMs = createdAtSeconds * 1000;
  // Guna beza hari kalendar berdasarkan tarikh sahaja (abaikan masa dalam hari).
  const hariJurang = Math.floor((createdMs - lawatanMs) / 86_400_000);

  if (hariJurang <= AMBANG_BACKDATE_NORMAL_HARI) {
    return { status: 'normal', hariJurang, label: '' };
  }
  if (hariJurang <= AMBANG_BACKDATE_LEWAT_HARI) {
    return {
      status: 'lewat',
      hariJurang,
      label: `Direkod ${hariJurang} hari selepas tarikh lawatan`,
    };
  }
  return {
    status: 'backdate',
    hariJurang,
    label: `Direkod ${hariJurang} hari selepas tarikh lawatan — sila sahkan tarikh lawatan sebenar`,
  };
}
