import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function getAdminApp() {
  if (!adminApp) {
    if (getApps().length === 0) {
      adminApp = initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || '',
          clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '',
          privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
        }),
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
