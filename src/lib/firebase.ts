import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  Firestore,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Adakah config lengkap? Semasa prerender build di pelayan, env NEXT_PUBLIC_*
// mungkin tiada — jika begitu, JANGAN init Firebase (elak crash
// auth/invalid-api-key yang menggagalkan build).
const configLengkap = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;

if (configLengkap) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

  // --- Auth with LOCAL persistence (survive offline + page reloads) ---
  auth = getAuth(app);
  if (typeof window !== 'undefined') {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('[Auth] Persistence setup error:', err?.message);
    });
  }

  // --- Firestore with multi-tab offline persistence ---
  if (typeof window !== 'undefined') {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
          cacheSizeBytes: CACHE_SIZE_UNLIMITED,
        }),
      });
    } catch {
      // Firestore already initialized (hot module reload in dev)
      db = getFirestore(app);
    }
  } else {
    // Server-side: no persistence needed
    db = getFirestore(app);
  }

  // --- Firebase Storage (untuk gambar bukti lawatan) ---
  storage = getStorage(app);
}

// Eksport dengan cast non-null: dalam penggunaan sebenar (runtime pelayar),
// config sentiasa lengkap jadi nilai ini pasti wujud. Hanya semasa prerender
// build (tanpa env) ia undefined, dan kod pelayar tidak dijalankan ketika itu.
// Cast menjaga jenis sedia ada supaya fail lain tidak perlu diubah.
const authExport = auth as Auth;
const dbExport = db as Firestore;
const storageExport = storage as FirebaseStorage;

export {
  app,
  authExport as auth,
  dbExport as db,
  storageExport as storage,
};
