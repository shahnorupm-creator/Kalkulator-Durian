'use client';

import { driver, type DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

// ── Tour guide berpusat (driver.js) ──────────────────────────────────────────
// Setiap halaman ada set langkah sendiri, disasarkan melalui atribut
// data-tour="..." pada elemen. Tour muncul secara automatik pada kali pertama
// pengguna sampai ke halaman (dijejak dalam localStorage), dan boleh dilancarkan
// semula melalui butang "Panduan".

export type TourPageKey = 'kebun' | 'peta' | 'kalkulator' | 'dashboard' | 'laporan' | 'profil' | 'admin';

const LANGKAH: Record<TourPageKey, DriveStep[]> = {
  kebun: [
    { element: '[data-tour="kebun-tajuk"]', popover: { title: 'Profil & Kebun', description: 'Di sini anda mendaftar dan mengurus profil kebun durian. Data ini menjadi asas kepada kalkulator, dashboard dan laporan.' } },
    { element: '[data-tour="kebun-tambah"]', popover: { title: 'Tambah Kebun', description: 'Tekan butang ini untuk mendaftar kebun baharu. Isi maklumat seperti nama, lokasi, keluasan dan varieti pokok.' } },
    { element: '[data-tour="kebun-carian"]', popover: { title: 'Cari & Tapis', description: 'Gunakan carian dan penapis negeri/daerah untuk mencari kebun dengan pantas.' } },
    { element: '[data-tour="kebun-senarai"]', popover: { title: 'Senarai Kebun', description: 'Semua kebun dalam skop anda dipaparkan di sini. Klik mana-mana kebun untuk mengemas kini maklumatnya.' } },
  ],
  peta: [
    { element: '[data-tour="peta-tajuk"]', popover: { title: 'Peta Negeri', description: 'Lihat taburan kebun durian mengikut negeri berdasarkan skop capaian akaun anda.' } },
    { element: '[data-tour="peta-kpi"]', popover: { title: 'Ringkasan Negeri', description: 'Semak jumlah kebun, daerah, keluasan dan bilangan pokok dalam skop yang dibenarkan.' } },
    { element: '[data-tour="peta-interaktif"]', popover: { title: 'Peta Interaktif', description: 'Pilih negeri yang dibenarkan. Pengguna negeri hanya boleh membuka negeri yang ditetapkan pada profil.' } },
    { element: '[data-tour="peta-butiran"]', popover: { title: 'Butiran Kebun', description: 'Lihat pecahan daerah, senarai kebun, pegawai yang ditugaskan dan status koordinat GPS.' } },
  ],
  kalkulator: [
    { element: '[data-tour="kalkulator-tajuk"]', popover: { title: 'Kalkulator Pengeluaran', description: 'Kira anggaran hasil durian dan rekod pemantauan lawatan di sini, dalam tiga langkah mudah.' } },
    { element: '[data-tour="kalkulator-pilih"]', popover: { title: 'Langkah 1: Pilih Kebun', description: 'Pilih kebun yang anda lawati. Bendera negeri membantu anda menapis mengikut negeri.' } },
    { element: '[data-tour="kalkulator-tarikh"]', popover: { title: 'Langkah 2: Tarikh & Fasa', description: 'Isi tarikh lawatan sebenar dan pilih fasa pengeluaran semasa yang anda lihat di kebun.' } },
    { element: '[data-tour="kalkulator-gambar"]', popover: { title: 'Gambar Bukti', description: 'Ambil 5 gambar terus di kebun sebagai bukti lawatan. Lokasi, masa dan identiti anda direkod secara automatik.' } },
    { element: '[data-tour="kalkulator-peratus"]', popover: { title: 'Peratus Fasa', description: 'Tetapkan peratus pokok bagi setiap fasa. Jumlah mesti 100%.' } },
  ],
  dashboard: [
    { element: '[data-tour="dashboard-tajuk"]', popover: { title: 'Dashboard Eksekutif', description: 'Paparan analisis pengeluaran durian seluruh Malaysia untuk pengurusan atasan.' } },
    { element: '[data-tour="dashboard-kpi"]', popover: { title: 'Petunjuk Utama', description: 'Ringkasan jumlah kebun, keluasan, anggaran hasil dan kategori varieti secara sekali pandang.' } },
    { element: '[data-tour="dashboard-negeri"]', popover: { title: 'Ringkasan Negeri', description: 'Pecahan data mengikut negeri — kebun, keluasan, pokok dan hasil.' } },
  ],
  laporan: [
    { element: '[data-tour="laporan-tajuk"]', popover: { title: 'Laporan & Infografik', description: 'Jana laporan visual anggaran pengeluaran yang boleh dimuat turun dan dikongsi.' } },
    { element: '[data-tour="laporan-jana"]', popover: { title: 'Jana Infografik', description: 'Tekan untuk menjana laporan sebagai imej. Anda boleh memuat turunnya selepas itu.' } },
  ],
  profil: [
    { element: '[data-tour="profil-tajuk"]', popover: { title: 'Profil Saya', description: 'Lihat dan kemas kini maklumat peribadi anda serta kata laluan.' } },
    { element: '[data-tour="profil-edit"]', popover: { title: 'Kemas Kini Profil', description: 'Tekan untuk mengemas kini nama, no. pekerja, daerah dan nombor telefon anda.' } },
  ],
  admin: [
    { element: '[data-tour="admin-tajuk"]', popover: { title: 'Panel Admin', description: 'Urus pengguna sistem — cipta akaun, tetapkan peranan, negeri dan daerah.' } },
    { element: '[data-tour="admin-tambah"]', popover: { title: 'Tambah Pengguna', description: 'Cipta akaun pengguna baharu dan tetapkan peranan mereka.' } },
  ],
};

const kunciLocalStorage = (page: TourPageKey) => `durian-tour-${page}`;

function jalankanTour(page: TourPageKey) {
  const langkah = LANGKAH[page];
  if (!langkah || langkah.length === 0) return;

  // Hanya sertakan langkah yang elemennya wujud pada halaman (elak langkah kosong
  // untuk elemen yang tersembunyi mengikut peranan).
  const langkahSah = langkah.filter(s =>
    typeof s.element === 'string' ? document.querySelector(s.element) : true
  );
  if (langkahSah.length === 0) return;

  const pemandu = driver({
    showProgress: true,
    nextBtnText: 'Seterusnya',
    prevBtnText: 'Kembali',
    doneBtnText: 'Selesai',
    progressText: '{{current}} / {{total}}',
    steps: langkahSah,
  });
  pemandu.drive();
}

// Lancarkan tour secara automatik pada kali pertama sahaja.
export function mulaTourJikaBaharu(page: TourPageKey) {
  if (typeof window === 'undefined') return;
  const kunci = kunciLocalStorage(page);
  if (localStorage.getItem(kunci)) return;
  // Tunggu sebentar supaya DOM halaman selesai render.
  setTimeout(() => {
    jalankanTour(page);
    localStorage.setItem(kunci, '1');
  }, 800);
}

// Lancarkan tour secara manual (butang Panduan) — sentiasa jalan.
export function mulaTourManual(page: TourPageKey) {
  if (typeof window === 'undefined') return;
  jalankanTour(page);
  localStorage.setItem(kunciLocalStorage(page), '1');
}
