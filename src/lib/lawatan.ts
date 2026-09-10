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
