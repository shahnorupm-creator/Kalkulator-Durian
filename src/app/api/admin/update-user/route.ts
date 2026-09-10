import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { verifyCaller, AuthError } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

const VALID_ROLES = ['superadmin', 'admin_negeri', 'admin_hq', 'pegawai_daerah', 'pegawai'];

export async function POST(request: NextRequest) {
  try {
    // Sahkan pemanggil dahulu; kebenaran diperincikan mengikut medan yang hendak diubah.
    const caller = await verifyCaller(request);

    const { uid, email, password, role, negeri, daerah } = await request.json();

    if (!uid) {
      return NextResponse.json(
        { error: 'UID pengguna diperlukan.' },
        { status: 400 }
      );
    }

    const wantEmail = typeof email === 'string' && email.trim().length > 0;
    const wantPassword = typeof password === 'string' && password.trim().length > 0;
    const wantRole = typeof role === 'string' && role.trim().length > 0;
    const wantNegeri = typeof negeri === 'string';
    const wantDaerah = typeof daerah === 'string';

    if (!wantEmail && !wantPassword && !wantRole && !wantNegeri && !wantDaerah) {
      return NextResponse.json(
        { error: 'Tiada medan untuk dikemas kini.' },
        { status: 400 }
      );
    }

    if (wantPassword && password.trim().length < 6) {
      return NextResponse.json(
        { error: 'Kata laluan mesti sekurang-kurangnya 6 aksara.' },
        { status: 400 }
      );
    }

    if (wantRole && !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Role tidak sah.' },
        { status: 400 }
      );
    }

    const auth = adminAuth();
    const db = adminDb();

    // Ambil dokumen sasaran untuk semakan skop.
    const targetSnap = await db.collection('users').doc(uid).get();
    if (!targetSnap.exists) {
      return NextResponse.json({ error: 'Pengguna tidak dijumpai.' }, { status: 404 });
    }
    const target = targetSnap.data() || {};

    const isSuperadmin = caller.role === 'superadmin';
    const isAdminNegeri = caller.role === 'admin_negeri';

    // ── Kebenaran ──
    // Email, kata laluan, role dan negeri: superadmin sahaja.
    if ((wantEmail || wantPassword || wantRole || wantNegeri) && !isSuperadmin) {
      return NextResponse.json(
        { error: 'Hanya superadmin boleh menukar email, kata laluan, role atau negeri.' },
        { status: 403 }
      );
    }

    // Daerah seliaan: superadmin untuk semua; admin negeri hanya untuk pegawai dalam negerinya.
    if (wantDaerah && !isSuperadmin) {
      if (!isAdminNegeri) {
        return NextResponse.json(
          { error: 'Anda tidak mempunyai kebenaran untuk menukar daerah seliaan.' },
          { status: 403 }
        );
      }
      const sasaranDalamNegeri = (target.negeri || '') === caller.negeri;
      const sasaranPegawai = target.role === 'pegawai' || target.role === 'pegawai_daerah';
      if (!caller.negeri || !sasaranDalamNegeri || !sasaranPegawai) {
        return NextResponse.json(
          { error: 'Admin negeri hanya boleh menetapkan daerah pegawai dalam negerinya sendiri.' },
          { status: 403 }
        );
      }
    }

    // ── Kemas kini Firebase Auth (email/kata laluan) ──
    const authPayload: { email?: string; password?: string } = {};
    if (wantEmail) authPayload.email = email.trim();
    if (wantPassword) authPayload.password = password.trim();
    if (Object.keys(authPayload).length > 0) {
      await auth.updateUser(uid, authPayload);
    }

    // ── Kemas kini dokumen Firestore ──
    const docPayload: Record<string, string> = {};
    if (wantEmail) docPayload.email = email.trim();
    if (wantRole) docPayload.role = role;
    if (wantNegeri) docPayload.negeri = negeri;
    if (wantDaerah) docPayload.daerah = daerah;
    if (Object.keys(docPayload).length > 0) {
      docPayload.updatedAt = new Date().toISOString();
      await db.collection('users').doc(uid).update(docPayload);
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
