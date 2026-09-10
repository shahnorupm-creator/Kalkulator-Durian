import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { requireRole, AuthError } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Hanya superadmin boleh kemas kini email/kata laluan pengguna
    await requireRole(request, ['superadmin']);

    const { uid, email, password } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'UID pengguna diperlukan.' },
        { status: 400 }
      );
    }

    // Sekurang-kurangnya satu medan mesti ada untuk dikemas kini
    if (!email && !password) {
      return NextResponse.json(
        { error: 'Sila isi email atau kata laluan baru untuk dikemas kini.' },
        { status: 400 }
      );
    }

    if (password && password.length < 6) {
      return NextResponse.json(
        { error: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' },
        { status: 400 }
      );
    }

    const auth = adminAuth();
    const db = adminDb();

    // Bina objek kemas kini untuk Firebase Auth
    const updatePayload: { email?: string; password?: string } = {};
    if (email) updatePayload.email = email;
    if (password) updatePayload.password = password;

    await auth.updateUser(uid, updatePayload);

    // Segerakkan email ke dokumen Firestore (kata laluan tidak disimpan di Firestore)
    if (email) {
      await db.collection('users').doc(uid).update({
        email,
        updatedAt: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Maklumat pengguna berjaya dikemas kini.',
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating user:', error);
    let message = error instanceof Error ? error.message : 'Ralat dalaman pelayan.';

    // Terjemah ralat Firebase yang biasa kepada Bahasa Melayu
    if (message.includes('email-already-exists')) {
      message = 'Email ini telah digunakan oleh pengguna lain.';
    } else if (message.includes('invalid-email')) {
      message = 'Format email tidak sah.';
    } else if (message.includes('user-not-found')) {
      message = 'Pengguna tidak dijumpai.';
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
