import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

/**
 * Baca kunci peribadi Firebase Admin. Utamakan versi base64
 * (FIREBASE_ADMIN_PRIVATE_KEY_B64) kerana ia selamat daripada masalah
 * baris-baru / terpotong semasa ditampal ke Vercel. Jika tiada, guna
 * FIREBASE_ADMIN_PRIVATE_KEY (format \n literal atau baris baru sebenar).
 */
function readPrivateKey(): string {
  const b64 = process.env.FIREBASE_ADMIN_PRIVATE_KEY_B64 || '';
  if (b64.trim()) {
    try {
      return Buffer.from(b64.trim(), 'base64').toString('utf8');
    } catch {
      // jatuh ke bawah dan cuba kunci biasa
    }
  }

  let key = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';
  // Buang petikan luar jika tertampal dengan " ".
  if (key.startsWith('"') && key.endsWith('"')) {
    key = key.slice(1, -1);
  }
  // Tukar \n literal kepada baris baru sebenar.
  return key.replace(/\\n/g, '\n');
}

function getAdminApp() {
  if (!adminApp) {
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || '';
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
      let privateKey = readPrivateKey();

      // Beri mesej jelas jika mana-mana kredensial hilang (bukan 401 mengelirukan).
      if (!projectId || !clientEmail || !privateKey) {
        const missing = [
          !projectId && 'FIREBASE_ADMIN_PROJECT_ID',
          !clientEmail && 'FIREBASE_ADMIN_CLIENT_EMAIL',
          !privateKey && 'FIREBASE_ADMIN_PRIVATE_KEY',
        ]
          .filter(Boolean)
          .join(', ');
        throw new Error(
          `Konfigurasi Firebase Admin tidak lengkap. Env var hilang: ${missing}. ` +
            `Sila set di Vercel → Settings → Environment Variables, kemudian redeploy.`
        );
      }

      adminApp = initializeApp({
        credential: cert({ projectId, clientEmail, privateKey }),
      });
    } else {
      adminApp = getApps()[0];
    }
  }
  return adminApp;
}

function getAdminAuth() {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

function getAdminDb() {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export { getAdminAuth as adminAuth, getAdminDb as adminDb };
