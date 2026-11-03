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

// Konfigurasi Firebase CLIENT. Nilai ini BUKAN rahsia — ia memang didedahkan
// dalam bundle JavaScript pelayar dan selamat untuk dikod terus (keselamatan
// dijaga oleh Firebase Security Rules, bukan kerahsiaan apiKey). Kita utamakan
// env var NEXT_PUBLIC_* jika ada, dan jatuh balik ke nilai projek ini supaya
// build & runtime tidak gagal walaupun env var tidak di-inject di Vercel.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDnHXLmFT4GmsSS4QQ9QUEw5nhZ1Zsuw7A',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'kalkulator-durian.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'kalkulator-durian',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'kalkulator-durian.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '29425935527',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:29425935527:web:3931954241f426f1f82782',
};

// Initialize Firebase
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// --- Auth with LOCAL persistence (survive offline + page reloads) ---
const auth: Auth = getAuth(app);
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.warn('[Auth] Persistence setup error:', err?.message);
  });
}

// --- Firestore with multi-tab offline persistence ---
let db: Firestore;
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
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
