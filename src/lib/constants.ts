// Durian variety data
export const VARIETIES = [
  { key: 'musangking', name: 'Musang King (D197)', bilanganBuah: 100, beratPerBuah: 1.5, hasil: 150 },
  { key: 'blackthorn', name: 'Black Thorn (D200)', bilanganBuah: 85, beratPerBuah: 1.5, hasil: 130 },
  { key: 'ioi', name: 'IOI / Hajah Hasmah (D168)', bilanganBuah: 93, beratPerBuah: 1.5, hasil: 140 },
  { key: 'udangmerah', name: 'Udang Merah (D175)', bilanganBuah: 97, beratPerBuah: 1.5, hasil: 145 },
  { key: 'kampung', name: 'Durian Kampung', bilanganBuah: 60, beratPerBuah: 1.5, hasil: 90 },
  { key: 'd24', name: 'D24 (Sultan)', bilanganBuah: 90, beratPerBuah: 1.5, hasil: 135 },
] as const;

// Growth stages
export const STAGES = [
  { key: 'mataketam', name: 'Mata Ketam', tempohHari: 'Hari 1-30', J: 120, defD: 0, defPct: 0, nota: 'Dari mata ketam perlukan 150 hari untuk buah gugur' },
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
  { key: '16-19', label: '16-19 tahun', faktorHasil: 1.0 },
  { key: '20+', label: '20+ tahun', faktorHasil: 1.2 },
] as const;

// Fasa pengeluaran
export const FASA_PENGELUARAN = [
  { key: 'fasa1', name: 'Fasa 1: Bunga / Pusingan Awal', bulan: ['Mac', 'Apr', 'Mei'] },
  { key: 'fasa2', name: 'Fasa 2: Putik / Penyusutan', bulan: ['Apr', 'Mei', 'Jun'] },
  { key: 'fasa3', name: 'Fasa 3: Buah Matang / Gugur', bulan: ['Jun', 'Jul', 'Ogos', 'Sep'] },
] as const;

export type VarietyKey = (typeof VARIETIES)[number]['key'];
