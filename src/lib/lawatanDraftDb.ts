'use client';

export type StatusDrafLawatan = 'pending' | 'uploading' | 'error';

export interface GambarDrafLawatan {
  index: number;
  blob: Blob;
  name: string;
  type: string;
  lastModified: number;
  capturedAtClient: string;
}

export interface PayloadDrafLawatan {
  kebunId: string;
  kebunNama: string;
  daerah: string;
  alamatKebun: string;
  tarikhLawatan: string;
  fasaUtama: string;
  saizKebun: number;
  jumlahPokok: number;
  stages: Record<string, { pct: number; d: number }>;
  varietiResults: { key: string; name: string; pokok: number; kg: number }[];
  totalKg: number;
  totalTan: number;
  pegawaiNama: string;
  pegawaiDaerah: string;
  negeri: string;
  pegawaiUid: string;
  pegawaiEmail: string;
  lokasiPegawai: string;
  lokasiAccuracy: number | null;
  jarakDariKebunM: number | null;
  statusLokasi: string;
  capturedAtClient: string;
}

export interface DrafLawatan {
  id: string;
  status: StatusDrafLawatan;
  createdAtClient: string;
  updatedAtClient: string;
  attempts: number;
  lastError?: string;
  pegawaiUid: string;
  payload: PayloadDrafLawatan;
  gambar: GambarDrafLawatan[];
}

const DB_NAME = 'kalkulator-durian-fama';
const DB_VERSION = 1;
const STORE_NAME = 'lawatanDrafts';
export const DRAF_LAWATAN_CHANGED_EVENT = 'lawatan-drafts-changed';

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Storan draf tidak disokong oleh pelayar ini.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('pegawaiUid', 'pegawaiUid', { unique: false });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAtClient', 'createdAtClient', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka storan draf.'));
  });
}

function tungguTransaksi(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('Transaksi storan draf gagal.'));
    tx.onabort = () => reject(tx.error || new Error('Transaksi storan draf dibatalkan.'));
  });
}

function maklumkanPerubahan() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DRAF_LAWATAN_CHANGED_EVENT));
}

export function janaIdDraf(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `draf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function simpanDrafLawatan(draf: DrafLawatan): Promise<void> {
  const db = await bukaDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(draf);
    await tungguTransaksi(tx);
    maklumkanPerubahan();
  } finally {
    db.close();
  }
}

export async function senaraiDrafLawatan(pegawaiUid: string): Promise<DrafLawatan[]> {
  const db = await bukaDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('pegawaiUid');
      const request = index.getAll(IDBKeyRange.only(pegawaiUid));
      request.onsuccess = () => {
        const draf = (request.result as DrafLawatan[])
          .map(item => item.status === 'uploading'
            ? { ...item, status: 'error' as const, lastError: 'Muat naik sebelumnya tidak selesai.' }
            : item)
          .sort((a, b) => b.createdAtClient.localeCompare(a.createdAtClient));
        resolve(draf);
      };
      request.onerror = () => reject(request.error || new Error('Gagal membaca draf lawatan.'));
    });
  } finally {
    db.close();
  }
}

export async function kemasKiniDrafLawatan(
  draf: DrafLawatan,
  perubahan: Partial<Pick<DrafLawatan, 'status' | 'attempts' | 'lastError'>>
): Promise<DrafLawatan> {
  const dikemasKini: DrafLawatan = {
    ...draf,
    ...perubahan,
    updatedAtClient: new Date().toISOString(),
  };
  await simpanDrafLawatan(dikemasKini);
  return dikemasKini;
}

export async function padamDrafLawatan(id: string): Promise<void> {
  const db = await bukaDb();
  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    await tungguTransaksi(tx);
    maklumkanPerubahan();
  } finally {
    db.close();
  }
}
