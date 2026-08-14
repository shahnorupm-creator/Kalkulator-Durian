'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';

interface Pekebun {
  nama: string;
  daerah: string;
  mukim: string;
  alamatKebun: string;
  lat: string;
  long: string;
}

interface Lawatan {
  id: string;
  tarikhLawatan: string;
  varieti: string;
  jumlahPokok: number;
  totalKg: number;
  createdAt?: { seconds: number };
}

export default function PekebunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const pekebunId = params.id as string;

  const [pekebun, setPekebun] = useState<Pekebun | null>(null);
  const [lawatanList, setLawatanList] = useState<Lawatan[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Pekebun>({
    nama: '',
    daerah: '',
    mukim: '',
    alamatKebun: '',
    lat: '',
    long: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchPekebun = async () => {
      const docRef = doc(db, 'users', user.uid, 'pekebun', pekebunId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as Pekebun;
        setPekebun(data);
        setForm(data);
      }
      setLoading(false);
    };

    fetchPekebun();

    // Listen to lawatan subcollection
    const lawatanQuery = query(
      collection(db, 'users', user.uid, 'pekebun', pekebunId, 'lawatan'),
      orderBy('tarikhLawatan', 'desc')
    );

    const unsubscribe = onSnapshot(lawatanQuery, (snapshot) => {
      const list: Lawatan[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Lawatan[];
      setLawatanList(list);
    });

    return () => unsubscribe();
  }, [user, pekebunId]);

  const handleUpdate = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'pekebun', pekebunId), {
        nama: form.nama,
        daerah: form.daerah,
        mukim: form.mukim,
        alamatKebun: form.alamatKebun,
        lat: form.lat,
        long: form.long,
      });
      setPekebun(form);
      setEditing(false);
      toast.success('Maklumat pekebun dikemas kini!');
    } catch (error) {
      console.error(error);
      toast.error('Gagal mengemaskini.');
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (!confirm('Adakah anda pasti mahu memadam pekebun ini? Data tidak dapat dipulihkan.')) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'pekebun', pekebunId));
      toast.success('Pekebun berjaya dipadam.');
      router.push('/pekebun');
    } catch (error) {
      console.error(error);
      toast.error('Gagal memadam.');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="bg-white rounded-2xl p-6 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!pekebun) {
    return <p className="text-gray-500 text-center py-12">Pekebun tidak dijumpai.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={() => router.push('/pekebun')} className="text-forest text-xl">
          ←
        </button>
        <h2 className="text-xl font-bold text-forest">{pekebun.nama}</h2>
      </div>

      {/* Pekebun Info Card */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border-l-4 border-moss">
        {editing ? (
          <div className="space-y-3">
            <input
              type="text"
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Nama"
            />
            <input
              type="text"
              value={form.daerah}
              onChange={(e) => setForm({ ...form, daerah: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Daerah"
            />
            <input
              type="text"
              value={form.mukim}
              onChange={(e) => setForm({ ...form, mukim: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Mukim"
            />
            <textarea
              value={form.alamatKebun}
              onChange={(e) => setForm({ ...form, alamatKebun: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              placeholder="Alamat Kebun"
              rows={2}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={form.lat}
                onChange={(e) => setForm({ ...form, lat: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="Latitude"
              />
              <input
                type="text"
                value={form.long}
                onChange={(e) => setForm({ ...form, long: e.target.value })}
                className="px-3 py-2 border rounded-lg text-sm"
                placeholder="Longitude"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-forest text-white py-2 rounded-lg text-sm font-semibold"
              >
                Simpan
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setForm(pekebun);
                }}
                className="flex-1 border border-gray-300 py-2 rounded-lg text-sm"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-500">Daerah:</span> {pekebun.daerah}</p>
              <p><span className="text-gray-500">Mukim:</span> {pekebun.mukim || '-'}</p>
              <p><span className="text-gray-500">Alamat:</span> {pekebun.alamatKebun || '-'}</p>
              <p><span className="text-gray-500">Koordinat:</span> {pekebun.lat && pekebun.long ? `${pekebun.lat}, ${pekebun.long}` : '-'}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing(true)}
                className="flex-1 border border-forest text-forest py-2 rounded-lg text-sm font-semibold"
              >
                ✏️ Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 border border-red-300 text-red-600 py-2 rounded-lg text-sm font-semibold"
              >
                🗑️ Padam
              </button>
            </div>
          </>
        )}
      </div>

      {/* Lawatan Section */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-forest">Rekod Lawatan</h3>
        <Link
          href={`/pekebun/${pekebunId}/lawatan/baru`}
          className="bg-gold text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gold/80 transition-colors"
        >
          + Lawatan Baru
        </Link>
      </div>

      {lawatanList.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-xl">
          <span className="text-3xl block mb-2">📋</span>
          <p className="text-gray-500 text-sm">Belum ada rekod lawatan.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lawatanList.map((l) => (
            <div
              key={l.id}
              className="bg-white rounded-xl p-4 shadow-sm border-l-4 border-gold"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-forest text-sm">{l.varieti}</p>
                  <p className="text-xs text-gray-500">{l.tarikhLawatan}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-forest">{l.totalKg?.toFixed(1)} kg</p>
                  <p className="text-xs text-gray-500">{(l.totalKg / 1000).toFixed(3)} tan</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {l.jumlahPokok} pokok berbuah
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
