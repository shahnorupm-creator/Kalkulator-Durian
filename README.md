# Kalkulator Durian FAMA — PWA

Sistem Kalkulator Anggaran Pengeluaran Durian untuk pegawai FAMA Malaysia. Progressive Web App (PWA) dengan sokongan offline penuh.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **UI:** React 18 + Tailwind CSS
- **Backend:** Firebase (Auth + Firestore)
- **Language:** TypeScript
- **PWA:** Custom Service Worker + manifest.json

## Features

### Core
- Pendaftaran & pengurusan kebun pekebun durian
- Kalkulator anggaran pengeluaran berdasarkan fasa pokok
- Dashboard HQ — analisis keseluruhan negeri
- Laporan infografik (canvas-based, downloadable PNG)
- Profil pegawai & tukar kata laluan

### Offline Mode
- Service Worker cache semua pages & static assets
- Firebase Auth persistence (kekal login walaupun offline)
- Firestore offline persistence (multi-tab, unlimited cache)
- Visual "Pending Sync" badge
- Offline indicator banner (orange offline / green back-online)
- Auto-sync apabila kembali online

### Bilingual (BM / English)
- Toggle bahasa di login page & sidebar
- Pilihan bahasa disimpan dalam localStorage
- Semua UI labels, buttons, toasts dalam kedua-dua bahasa

### Role-Based Access
- `superadmin` — Akses penuh
- `admin_negeri` — Urus negeri sendiri
- `admin_hq` — Dashboard & analisis
- `pegawai_daerah` — Kebun assigned
- `pegawai` — Kebun assigned sahaja

## Getting Started

### Prerequisites
- Node.js 18+
- npm atau yarn
- Firebase project (Auth + Firestore enabled)

### Installation

```bash
cd pwa
npm install
```

### Environment Variables

Cipta `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Development

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
pwa/
├── public/
│   ├── sw.js              # Service Worker (offline caching)
│   ├── manifest.json      # PWA manifest
│   ├── flags/             # SVG bendera negeri Malaysia
│   └── icons/             # App icons (192x192, 512x512)
├── src/
│   ├── app/
│   │   ├── layout.tsx     # Root layout (providers)
│   │   ├── globals.css    # Tailwind + custom styles
│   │   ├── login/         # Login page + language toggle
│   │   └── (dashboard)/   # Protected routes
│   │       ├── page.tsx           # Profil & Kebun
│   │       ├── kalkulator/        # Usia & Fasa calculator
│   │       ├── dashboard-hq/     # Executive dashboard
│   │       ├── laporan/          # Reports & infographic
│   │       ├── profil/           # User profile
│   │       └── admin/            # Admin panel
│   ├── components/
│   │   ├── Navbar.tsx             # Mobile nav (bottom)
│   │   ├── OfflineIndicator.tsx   # Offline/online banner
│   │   ├── PendingSyncBadge.tsx   # Sync status badge
│   │   ├── AutoSyncManager.tsx    # Auto-sync on reconnect
│   │   └── ServiceWorkerRegister.tsx
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Firebase Auth + roles
│   │   └── LanguageContext.tsx    # BM/EN i18n
│   └── lib/
│       ├── firebase.ts           # Firebase config + offline
│       ├── constants.ts          # Varieties, stages, negeri
│       ├── i18n.ts               # Translation dictionary
│       └── useOfflineSync.ts     # Sync status hook
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Offline Flow

```
1. Login online → Auth token cached in IndexedDB
2. Masuk kawasan offline → Banner "Mod Offline Aktif"
3. Key in data → Firestore writes queue locally
4. Badge "Pending Sync (N)" muncul
5. Keluar kawasan → Online detected → Auto-sync
6. Toast "Data berjaya disegerakkan" ✓
```

## Deployment

PWA boleh deploy ke mana-mana hosting yang support Node.js:
- Vercel (recommended untuk Next.js)
- Firebase Hosting
- AWS Amplify

---

FAMA Malaysia © 2026
