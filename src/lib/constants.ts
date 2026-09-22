// Durian variety data
// tempohMatang: bilangan hari dari BERBUNGA (antesis) sehingga buah gugur/matang.
// Sumber: Pakej Teknologi Durian JPM 2024, Jadual 12 (tengah julat). Varieti yang
// tiada dalam jadual (Udang Merah, Kampung) menggunakan anggaran munasabah.
export const VARIETIES = [
  { key: 'musangking', name: 'Musang King (D197)', bilanganBuah: 100, beratPerBuah: 1.5, hasil: 150, tempohMatang: 100, note: 'Isi kuning keemasan dengan rasa pahit-manis. Laraskan tempoh peringkat mengikut pemerhatian sebenar di kebun.' },
  { key: 'blackthorn', name: 'Black Thorn (D200)', bilanganBuah: 85, beratPerBuah: 1.5, hasil: 130, tempohMatang: 95, note: 'Duri Hitam mempunyai isi pekat dan tempoh matang yang lazimnya lebih panjang. Gunakan pemerhatian lapangan sebenar.' },
  { key: 'ioi', name: 'IOI / Hajah Hasmah (D168)', bilanganBuah: 93, beratPerBuah: 1.5, hasil: 140, tempohMatang: 110, note: 'IOI juga dikenali sebagai Hajah Hasmah atau Mas Muar. Buah sederhana dengan rasa manis dan kurang pahit.' },
  { key: 'udangmerah', name: 'Udang Merah (D175)', bilanganBuah: 97, beratPerBuah: 1.5, hasil: 145, tempohMatang: 105, note: 'Udang Merah mempunyai isi jingga kemerahan dan rasa manis berlemak. Sahkan tahap kematangan melalui lawatan kebun.' },
  { key: 'kampung', name: 'Durian Kampung', bilanganBuah: 60, beratPerBuah: 1.5, hasil: 90, tempohMatang: 100, note: 'Durian baka biji benih mempunyai saiz, hasil dan kualiti yang tidak seragam antara pokok.' },
  { key: 'd24', name: 'Bukit Merah/Sultan (D24)', bilanganBuah: 90, beratPerBuah: 1.5, hasil: 135, tempohMatang: 110, note: 'D24 mempunyai isi kuning keemasan dan rasa pahit sederhana. Laraskan anggaran berdasarkan keadaan kebun.' },
] as const;

// Tempoh matang lalai (hari) bagi rekod tanpa varieti dikenal pasti.
// Sepadan dengan nilai J fasa Berbunga sedia ada supaya kelakuan kekal seperti asal.
export const TEMPOH_MATANG_LALAI = 120;

// Growth stages
export const STAGES = [
  { key: 'mataketam', name: 'Mata Ketam', tempohHari: 'Hari 1-30', J: 150, defD: 0, defPct: 0, nota: 'Dari mata ketam perlukan 150 hari untuk buah gugur' },
  { key: 'berbunga', name: 'Berbunga', tempohHari: 'Hari 31-60', J: 120, defD: 9, defPct: 0, nota: 'Dari berbunga perlukan 120 hari untuk buah gugur' },
  { key: 'putik', name: 'Putik Buah', tempohHari: 'Hari 61-90', J: 90, defD: 40, defPct: 0, nota: 'Dari putik buah perlukan 90 hari untuk buah gugur' },
  { key: 'kecil', name: 'Buah Kecil', tempohHari: 'Hari 91-120', J: 60, defD: 40, defPct: 22, nota: 'Dari buah kecil perlukan 60 hari untuk buah gugur' },
  { key: 'besar', name: 'Buah Besar', tempohHari: 'Hari 121-150', J: 30, defD: 2, defPct: 73, nota: 'Dari buah besar perlukan 30 hari untuk buah gugur' },
  { key: 'tidak', name: 'Tidak Berbuah', tempohHari: '-', J: null, defD: null, defPct: 5, nota: 'Pokok tidak mengeluarkan buah pada musim ini' },
] as const;

// Malaysia Negeri & Daerah
export const NEGERI_DAERAH: Record<string, string[]> = {
  'Johor': ['Batu Pahat', 'Tangkak', 'Segamat', 'Muar', 'Kluang', 'Mersing', 'Kota Tinggi', 'Kulai', 'Pontian', 'Johor Bahru'],
  'Kedah': ['Bandar Baharu', 'Sik', 'Padang Terap', 'Pendang', 'Kubang Pasu', 'Kulim', 'Baling', 'Yan', 'Langkawi', 'Pokok Sena'],
  'Kelantan': ['Jeli', 'Kuala Krai', 'Tanah Merah', 'Machang', 'Pasir Puteh', 'Gua Musang', 'Tumpat', 'Kota Bharu', 'Bachok'],
  'Melaka': ['Jasin', 'Alor Gajah', 'Melaka Tengah'],
  'Negeri Sembilan': ['Jelebu', 'Port Dickson', 'Seremban', 'Kuala Pilah', 'Tampin', 'Rembau', 'Jempol'],
  'Pahang': ['Raub', 'Bentong', 'Jerantut', 'Lipis', 'Cameron Highlands', 'Temerloh', 'Maran', 'Kuantan', 'Pekan', 'Rompin', 'Bera'],
  'Perak': ['Larut', 'Matang', 'Selama', 'Hulu Perak', 'Manjung', 'Kinta', 'Kampar', 'Batang Padang', 'Tapah', 'Ipoh'],
  'Perlis': ['Kangar', 'Arau', 'Padang Besar'],
  'Pulau Pinang': ['Barat Daya', 'Seberang Perai Tengah', 'Seberang Perai Selatan', 'Seberang Perai Utara', 'Timur Laut'],
  'Sabah': ['Ranau', 'Sipitang', 'Tuaran', 'Kota Kinabalu', 'Sandakan', 'Tawau', 'Keningau', 'Beaufort'],
  'Sarawak': ['Kuching', 'Serian', 'Kapit', 'Sibu', 'Miri', 'Bintulu', 'Sri Aman', 'Sarikei'],
  'Selangor': ['Gombak', 'Hulu Selangor', 'Hulu Langat', 'Sepang', 'Kuala Langat', 'Petaling', 'Klang', 'Sabak Bernam'],
  'Terengganu': ['Hulu Terengganu', 'Kemaman', 'Dungun', 'Besut', 'Setiu', 'Marang', 'Kuala Terengganu'],
};

export const SENARAI_NEGERI = Object.keys(NEGERI_DAERAH);

// Padan nama daerah kepada negeri (untuk pulihkan negeri bagi rekod lama yang tiada medan negeri).
// Turut cuba padanan separa: jika teks mengandungi nama daerah atau nama negeri yang dikenali.
export function negeriDariDaerah(daerah?: string): string {
  if (!daerah || !daerah.trim()) return '';
  const cari = daerah.trim().toLowerCase();
  // 1) Padanan tepat nama daerah
  for (const [negeri, senaraiDaerah] of Object.entries(NEGERI_DAERAH)) {
    if (senaraiDaerah.some(d => d.toLowerCase() === cari)) return negeri;
  }
  // 2) Teks mengandungi nama daerah (contoh "Kulim, Kedah")
  for (const [negeri, senaraiDaerah] of Object.entries(NEGERI_DAERAH)) {
    if (senaraiDaerah.some(d => cari.includes(d.toLowerCase()))) return negeri;
  }
  // 3) Teks mengandungi nama negeri secara langsung
  for (const negeri of Object.keys(NEGERI_DAERAH)) {
    if (cari.includes(negeri.toLowerCase())) return negeri;
  }
  return '';
}

// Normalisasi paparan nama: "HUDA" atau "huda" -> "Huda", kekalkan akronim.
// Identiti user tetap ditentukan oleh email/UID log masuk; ini hanya untuk paparan.
const NAMA_ACRONYMS = ['FAMA', 'IOI', 'HQ', 'GPS', 'MARDI', 'MPOB', 'RISDA', 'FELDA', 'FELCRA', 'JPM', 'KPM'];
export function formatNamaPaparan(nama?: string): string {
  if (!nama || !nama.trim()) return '';
  return nama.replace(/\b[\p{L}']+/gu, (word) => {
    const upper = word.toUpperCase();
    if (NAMA_ACRONYMS.includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

// Bendera negeri Malaysia — using inline SVG color blocks (no external dependency, always works)
// Bendera negeri Malaysia — local static SVG files in /public/flags/
export const NEGERI_FLAG: Record<string, string> = {
  'Johor': '/flags/jhr.svg',
  'Kedah': '/flags/kdh.svg',
  'Kelantan': '/flags/ktn.svg',
  'Melaka': '/flags/mlk.svg',
  'Negeri Sembilan': '/flags/nsn.svg',
  'Pahang': '/flags/phg.svg',
  'Perak': '/flags/prk.svg',
  'Perlis': '/flags/pls.svg',
  'Pulau Pinang': '/flags/png.svg',
  'Sabah': '/flags/sbh.svg',
  'Sarawak': '/flags/swk.svg',
  'Selangor': '/flags/sgr.svg',
  'Terengganu': '/flags/trg.svg',
};

// Flag colors for rendering mini flag blocks (reliable, no external dependency)
export const NEGERI_FLAG_COLORS: Record<string, { top: string; bottom: string }> = {
  'Johor': { top: '#CC0000', bottom: '#003DA5' },
  'Kedah': { top: '#CC0000', bottom: '#006B3F' },
  'Kelantan': { top: '#CC0000', bottom: '#FFFFFF' },
  'Melaka': { top: '#003DA5', bottom: '#FFCD00' },
  'Negeri Sembilan': { top: '#FFCD00', bottom: '#000000' },
  'Pahang': { top: '#FFFFFF', bottom: '#000000' },
  'Perak': { top: '#FFFFFF', bottom: '#FFCD00' },
  'Perlis': { top: '#003DA5', bottom: '#FFCD00' },
  'Pulau Pinang': { top: '#003DA5', bottom: '#FFFFFF' },
  'Sabah': { top: '#003DA5', bottom: '#CC0000' },
  'Sarawak': { top: '#CC0000', bottom: '#FFCD00' },
  'Selangor': { top: '#CC0000', bottom: '#FFCD00' },
  'Terengganu': { top: '#FFFFFF', bottom: '#000000' },
};

// (old SVG-style removed - using top/bottom format above)

// Age brackets for trees
export const UMUR_POKOK = [
  { key: '5-9', label: '5-9 tahun', faktorHasil: 0.5 },
  { key: '10-15', label: '10-15 tahun', faktorHasil: 0.8 },
  { key: '16+', label: '16 tahun atas', faktorHasil: 1.0 },
] as const;

// Fasa pengeluaran
export const FASA_PENGELUARAN = [
  { key: 'fasa1', name: 'Fasa 1: Bunga / Pusingan Awal', bulan: ['Mac', 'Apr', 'Mei'] },
  { key: 'fasa2', name: 'Fasa 2: Putik / Penyusutan', bulan: ['Apr', 'Mei', 'Jun'] },
  { key: 'fasa3', name: 'Fasa 3: Buah Matang / Gugur', bulan: ['Jun', 'Jul', 'Ogos', 'Sep'] },
] as const;

export type VarietyKey = (typeof VARIETIES)[number]['key'];

// Format masa mengikut pembahagian Bahasa Melayu yang tepat
// Pagi: 12:01 AM – 11:59 AM | Tengah Hari: 12:00 PM – 1:59 PM
// Petang: 2:00 PM – 6:59 PM | Malam: 7:00 PM – 12:00 AM
export function formatMasaBM(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const h12 = hours % 12 || 12;
  const mm = String(minutes).padStart(2, '0');
  let period: string;
  if (hours >= 0 && hours < 12) {
    period = 'Pagi';
  } else if (hours >= 12 && hours < 14) {
    period = 'Tengah Hari';
  } else if (hours >= 14 && hours < 19) {
    period = 'Petang';
  } else {
    period = 'Malam';
  }
  return `${String(h12).padStart(2, '0')}:${mm} ${period}`;
}

export function formatMasaBMWithSeconds(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  const h12 = hours % 12 || 12;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  let period: string;
  if (hours >= 0 && hours < 12) {
    period = 'Pagi';
  } else if (hours >= 12 && hours < 14) {
    period = 'Tengah Hari';
  } else if (hours >= 14 && hours < 19) {
    period = 'Petang';
  } else {
    period = 'Malam';
  }
  return `${String(h12).padStart(2, '0')}:${mm}:${ss} ${period}`;
}

// ── Pengesahan GPS kehadiran pegawai ─────────────────────────────────────────
// Radius (meter) dari koordinat kebun yang dikira sebagai "berada di kebun".
// 300m dipilih kerana kebun durian biasanya luas (beberapa ekar) — cukup longgar
// untuk pergerakan dalam kebun, cukup ketat untuk mengesan pegawai yang jauh.
export const RADIUS_KEBUN_METER = 300;

export type StatusLokasi = 'disahkan' | 'jauh' | 'tiada';

export interface KeputusanLokasi {
  status: StatusLokasi;
  jarakMeter: number | null;
  label: string;
}

// Hurai rentetan "lat, long" (contoh "1.854230, 102.932100") kepada nombor.
export function huraiLatLong(latlong?: string): { lat: number; long: number } | null {
  if (!latlong) return null;
  const bahagian = latlong.split(',').map(s => Number(s.trim()));
  if (bahagian.length !== 2 || !Number.isFinite(bahagian[0]) || !Number.isFinite(bahagian[1])) return null;
  return { lat: bahagian[0], long: bahagian[1] };
}

// Kira jarak (meter) antara dua koordinat menggunakan formula Haversine.
export function jarakMeter(lat1: number, long1: number, lat2: number, long2: number): number {
  const R = 6_371_000; // jejari Bumi dalam meter
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLong = rad(long2 - long1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLong / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Tentukan status lokasi pegawai berbanding koordinat kebun.
// - disahkan: dalam RADIUS_KEBUN_METER
// - jauh: melebihi radius
// - tiada: koordinat pegawai atau kebun tidak tersedia
export function statusLokasiPegawai(
  lokasiPegawai: { lat: number; long: number } | null,
  latlongKebun?: string
): KeputusanLokasi {
  const kebun = huraiLatLong(latlongKebun);
  if (!lokasiPegawai || !kebun) {
    return { status: 'tiada', jarakMeter: null, label: 'Lokasi tidak disahkan' };
  }
  const jarak = jarakMeter(lokasiPegawai.lat, lokasiPegawai.long, kebun.lat, kebun.long);
  if (jarak <= RADIUS_KEBUN_METER) {
    return { status: 'disahkan', jarakMeter: jarak, label: 'Disahkan di kebun' };
  }
  const jarakKm = (jarak / 1000).toFixed(jarak < 10_000 ? 1 : 0);
  return { status: 'jauh', jarakMeter: jarak, label: `${jarakKm} km dari kebun` };
}
