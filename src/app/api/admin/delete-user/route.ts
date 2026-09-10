import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { requireRole, AuthError } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Hanya superadmin boleh memadam pengguna
    const caller = await requireRole(request, ['superadmin']);

    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'UID diperlukan.' },
        { status: 400 }
      );
    }

    if (uid === caller.uid) {
      return NextResponse.json(
        { error: 'Anda tidak boleh memadam akaun sendiri.' },
        { status: 400 }
      );
    }

    const auth = adminAuth();
    const db = adminDb();

    // Delete Firebase Auth user
    await auth.deleteUser(uid);

    // Delete Firestore user document
    await db.collection('users').doc(uid).delete();

    return NextResponse.json({
      success: true,
      message: 'Pegawai berjaya dipadam.',
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error deleting user:', error);
    const message =
      error instanceof Error ? error.message : 'Ralat dalaman pelayan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
