import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { uid } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'UID diperlukan.' },
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
    console.error('Error deleting user:', error);
    const message =
      error instanceof Error ? error.message : 'Ralat dalaman pelayan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
