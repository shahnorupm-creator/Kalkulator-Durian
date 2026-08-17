'use client';

import { useEffect, useState } from 'react';
import { useOfflineSync } from '@/lib/useOfflineSync';

/**
 * Full-width offline banner that slides down when user goes offline.
 * Also shows sync status and "back online" confirmation.
 */
export default function OfflineIndicator() {
  const { status, pendingCount, isOnline, lastSyncedAt } = useOfflineSync();
  const [showBackOnline, setShowBackOnline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  // Track transitions from offline → online
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline && isOnline) {
      // Just came back online
      setShowBackOnline(true);
      const timer = setTimeout(() => {
        setShowBackOnline(false);
        setWasOffline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  // "Back Online" toast-banner
  if (showBackOnline && isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] animate-slide-down">
        <div className="bg-green-600 text-white px-4 py-3 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">✅</span>
              <div>
                <p className="text-sm font-semibold">Kembali Online!</p>
                <p className="text-xs opacity-80">
                  {pendingCount > 0
                    ? `Menyegerakkan ${pendingCount} perubahan...`
                    : 'Semua data telah disegerakkan'}
                </p>
              </div>
            </div>
            {status === 'syncing' && (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            )}
          </div>
        </div>
      </div>
    );
  }

  // Offline banner
  if (!isOnline) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] animate-slide-down">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="text-lg animate-pulse">📡</span>
              <div>
                <p className="text-sm font-semibold">Mod Offline Aktif</p>
                <p className="text-xs opacity-90">
                  Data disimpan secara tempatan. Akan sync apabila kembali online.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {pendingCount > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs font-bold">
                  {pendingCount} pending
                </span>
              )}
              <div className="w-2.5 h-2.5 bg-red-300 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Syncing indicator (online but has pending writes)
  if (status === 'syncing' && pendingCount > 0) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] animate-slide-down">
        <div className="bg-blue-500 text-white px-4 py-2 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-xs font-medium">
                Menyegerakkan {pendingCount} perubahan ke pelayan...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
