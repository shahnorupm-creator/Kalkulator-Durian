import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { email, password, nama, noPerkerja, negeri, daerah, role } = await request.json();

    if (!email || !password || !nama) {
      return NextResponse.json(
        { error: 'Email, kata laluan, dan nama wajib diisi.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' },
        { status: 400 }
      );
    }

    const validRoles = ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'];
    const userRole = validRoles.includes(role) ? role : 'pegawai';

    const auth = adminAuth();
    const db = adminDb();

    const userRecord = await auth.createUser({
      email,
      password,
      displayName: nama,
    });

    await db.collection('users').doc(userRecord.uid).set({
      nama,
      email,
      noPerkerja: noPerkerja || '',
      negeri: negeri || '',
      daerah: daerah || '',
      role: userRole,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      message: 'Pengguna berjaya dicipta.',
    });
  } catch (error: unknown) {
    console.error('Error creating user:', error);
    const message = error instanceof Error ? error.message : 'Ralat dalaman pelayan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
