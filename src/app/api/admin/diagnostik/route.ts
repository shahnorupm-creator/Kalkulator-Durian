import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Endpoint diagnostik SEMENTARA untuk mengesan punca 401 pada API admin.
 * TIDAK mendedahkan nilai rahsia — hanya status kewujudan & format.
 * BUANG fail ini selepas masalah selesai.
 *
 * Buka: https://kalkulator-durian.vercel.app/api/admin/diagnostik
 */
export async function GET() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || '';
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY || '';

  const rawLen = privateKey.length;
  const hasOuterQuotes = privateKey.startsWith('"') && privateKey.endsWith('"');
  if (hasOuterQuotes) privateKey = privateKey.slice(1, -1);

  const hasLiteralBackslashN = privateKey.includes('\\n');
  const afterReplace = privateKey.replace(/\\n/g, '\n');
  const hasRealNewline = afterReplace.includes('\n');

  // Cuba init Admin SDK sebenar & verify ringan untuk tangkap ralat kredensial.
  let initStatus = 'tidak dicuba';
  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    if (getApps().length === 0) {
      initializeApp({
        credential: cert({ projectId, clientEmail, privateKey: afterReplace }),
      });
    }
    initStatus = 'OK — Admin SDK berjaya diinisialisasi';
  } catch (err) {
    initStatus = `GAGAL init: ${err instanceof Error ? err.message : String(err)}`;
  }

  return NextResponse.json({
    projectId_set: !!projectId,
    projectId_nilai: projectId || '(kosong)',
    clientEmail_set: !!clientEmail,
    clientEmail_hujung: clientEmail ? clientEmail.slice(-30) : '(kosong)',
    privateKey_set: !!privateKey,
    privateKey_panjang_mentah: rawLen,
    privateKey_ada_petik_luar: hasOuterQuotes,
    privateKey_ada_backslash_n_literal: hasLiteralBackslashN,
    privateKey_ada_newline_sebenar_selepas_tukar: hasRealNewline,
    privateKey_mula_betul: afterReplace.startsWith('-----BEGIN PRIVATE KEY-----'),
    privateKey_tamat_betul: afterReplace.trimEnd().endsWith('-----END PRIVATE KEY-----'),
    admin_sdk_init: initStatus,
  });
}
