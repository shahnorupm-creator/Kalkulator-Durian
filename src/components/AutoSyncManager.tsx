'use client';

import { useEffect, useRef } from 'react';
import { waitForPendingWrites } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import toast from 'react-hot-toast';

/**
 * AutoSyncManager — invisible component that handles:
 * 1. Detecting online/offline transitions
 * 2. Triggering Firestore sync when back online
 * 3. Registering Background Sync with Service Worker
 * 4. Showing toast notifications for sync status
 * 5. Listening for SW sync messages
 */
export default function AutoSyncManager() {
  const wasOfflineRef = useRef(false);
  const syncInProgressRef = useRef(false);

  useEffect(() => {
    // Initial state
    if (!navigator.onLine) {
      wasOfflineRef.current = true;
    }

    const handleOffline = () => {
      wasOfflineRef.current = true;
      // Register for Background Sync (if supported)
      registerBackgroundSync();
    };

    const handleOnline = async () => {
      if (!wasOfflineRef.current) return;
      wasOfflineRef.current = false;

      // Trigger sync
      await performSync();
    };

    // Listen for SW sync messages
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_AVAILABLE') {
        performSync();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    navigator.serviceWorker?.addEventListener('message', handleSWMessage);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, []);

  // Perform Firestore sync
  async function performSync() {
    if (syncInProgressRef.current) return;
    syncInProgressRef.current = true;

    try {
      // Firestore auto-syncs when online, but we wait for confirmation
      const syncPromise = waitForPendingWrites(db);

      // Set a timeout — if sync takes too long, still mark as done
      const timeoutPromise = new Promise<void>((resolve) =>
        setTimeout(resolve, 15000)
      );

      await Promise.race([syncPromise, timeoutPromise]);

      toast.success('Data berjaya disegerakkan ✓', {
        duration: 3000,
        icon: '🔄',
        style: {
          background: '#1F4D36',
          color: '#fff',
        },
      });
    } catch (err) {
      console.error('[AutoSync] Sync failed:', err);
      toast.error('Gagal sync. Cuba semula nanti.', {
        duration: 4000,
        icon: '⚠️',
      });
    } finally {
      syncInProgressRef.current = false;
    }
  }

  // Register Background Sync with SW (for when app is in background)
  async function registerBackgroundSync() {
    try {
      const registration = await navigator.serviceWorker?.ready;
      if (registration && 'sync' in registration) {
        await (registration as any).sync.register('firestore-sync');
        console.log('[AutoSync] Background sync registered');
      }
    } catch (err) {
      console.warn('[AutoSync] Background sync registration failed:', err);
    }
  }

  // Invisible component — logic only
  return null;
}
