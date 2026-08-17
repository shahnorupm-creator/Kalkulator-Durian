'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { waitForPendingWrites, onSnapshotsInSync } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error';

interface OfflineSyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: Date | null;
  isOnline: boolean;
}

/**
 * Hook to track Firestore offline sync status.
 * Detects pending writes and monitors sync state.
 */
export function useOfflineSync(): OfflineSyncState {
  const [status, setStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const pendingRef = useRef(0);

  // Track online/offline state
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const goOnline = () => {
      setIsOnline(true);
      // When coming back online, check for pending writes
      checkPendingWrites();
    };
    const goOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Check and wait for pending writes
  const checkPendingWrites = useCallback(async () => {
    try {
      setStatus('syncing');
      await waitForPendingWrites(db);
      setStatus('synced');
      setPendingCount(0);
      pendingRef.current = 0;
      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('[Sync] Error waiting for pending writes:', err);
      setStatus('error');
    }
  }, []);

  // Listen for snapshot sync events (fires when local writes sync with server)
  useEffect(() => {
    const unsubscribe = onSnapshotsInSync(db, () => {
      if (pendingRef.current > 0) {
        // Writes just synced
        pendingRef.current = 0;
        setPendingCount(0);
        setStatus('synced');
        setLastSyncedAt(new Date());
      }
    });

    return () => unsubscribe();
  }, []);

  // Expose a way to increment pending count (call after local writes)
  useEffect(() => {
    // Listen to custom event dispatched after Firestore writes
    const handlePendingWrite = () => {
      pendingRef.current += 1;
      setPendingCount(pendingRef.current);
      setStatus(navigator.onLine ? 'syncing' : 'pending');

      // If online, wait for sync to complete
      if (navigator.onLine) {
        waitForPendingWrites(db).then(() => {
          pendingRef.current = Math.max(0, pendingRef.current - 1);
          setPendingCount(pendingRef.current);
          if (pendingRef.current === 0) {
            setStatus('synced');
            setLastSyncedAt(new Date());
          }
        }).catch(() => {
          setStatus('error');
        });
      }
    };

    window.addEventListener('firestore-pending-write', handlePendingWrite);
    return () => {
      window.removeEventListener('firestore-pending-write', handlePendingWrite);
    };
  }, []);

  return { status, pendingCount, lastSyncedAt, isOnline };
}

/**
 * Call this after any Firestore write operation to track pending sync.
 * Example: after addDoc, setDoc, updateDoc, deleteDoc
 */
export function notifyPendingWrite() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('firestore-pending-write'));
  }
}
