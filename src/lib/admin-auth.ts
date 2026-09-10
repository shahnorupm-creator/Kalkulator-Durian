import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export type CallerRole =
  | 'superadmin'
  | 'admin_negeri'
  | 'admin_hq'
  | 'pegawai_daerah'
  | 'pegawai';

export interface Caller {
  uid: string;
  email: string;
  role: CallerRole | string;
  negeri: string;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Sahkan pemanggil daripada header Authorization: Bearer <idToken>.
 * Mengembalikan maklumat pengguna (termasuk role dari Firestore) atau
 * melontar AuthError jika token tidak sah / pengguna tidak wujud.
 */
export async function verifyCaller(request: NextRequest): Promise<Caller> {
  const header = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new AuthError('Tiada token pengesahan. Sila log masuk semula.', 401);
  }

  const idToken = match[1].trim();
  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    throw new AuthError('Token pengesahan tidak sah atau telah tamat tempoh.', 401);
  }

  const snap = await adminDb().collection('users').doc(decoded.uid).get();
  if (!snap.exists) {
    throw new AuthError('Akaun pemanggil tidak dijumpai.', 403);
  }

  const data = snap.data() || {};
  return {
    uid: decoded.uid,
    email: decoded.email || data.email || '',
    role: data.role || 'pegawai',
    negeri: data.negeri || '',
  };
}

/**
 * Sahkan pemanggil DAN pastikan ia mempunyai salah satu role yang dibenarkan.
 */
export async function requireRole(
  request: NextRequest,
  allowed: string[]
): Promise<Caller> {
  const caller = await verifyCaller(request);
  if (!allowed.includes(caller.role)) {
    throw new AuthError('Anda tidak mempunyai kebenaran untuk tindakan ini.', 403);
  }
  return caller;
}
