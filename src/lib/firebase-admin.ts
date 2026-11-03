import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function getAdminApp() {
  if (!adminApp) {
    if (getApps().length === 0) {
      const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || '';
      const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
      let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';

      // Buang petikan luar jika pengguna tertampal nilai dengan " " di Vercel,
      // kemudian tukar \n literal kepada baris baru sebenar.
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.slice(1, -1);
      }
      privateKey = privateKey.replace(/\\n/g, '\n');

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
