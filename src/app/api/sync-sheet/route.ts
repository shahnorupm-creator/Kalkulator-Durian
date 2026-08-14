import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Initialize Google Sheets API lazily
async function getSheets() {
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Google Sheet ID tidak dikonfigurasi.' },
        { status: 500 }
      );
    }

    const sheets = await getSheets();

    // Append row to the sheet
    const row = [
      data.tarikhLawatan || '',
      data.pegawaiNama || '',
      data.pegawaiNoPerkerja || '',
      data.pegawaiDaerah || '',
      data.pekebunNama || '',
      data.pekebunDaerah || '',
      data.pekebunMukim || '',
      data.varieti || '',
      data.saizKebun || '',
      data.kepadatan || '',
      data.pctMatang || '',
      data.jumlahPokok || '',
      data.hasilPerPokok || '',
      data.totalKg?.toFixed?.(2) || String(data.totalKg || ''),
      data.totalTan?.toFixed?.(3) || String(data.totalTan || ''),
      new Date().toISOString(),
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:P',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    return NextResponse.json({ success: true, message: 'Data berjaya disinkronkan ke Google Sheet.' });
  } catch (error: unknown) {
    console.error('Error syncing to Google Sheet:', error);
    const message = error instanceof Error ? error.message : 'Ralat sync Google Sheet.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
