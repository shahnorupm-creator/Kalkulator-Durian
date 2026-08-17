'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Register SW in production (or with ?sw-dev flag for testing)
    const shouldRegister =
      process.env.NODE_ENV === 'production' ||
      window.location.search.includes('sw-dev');

    if (!shouldRegister) return;

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Registered:', registration.scope);

        // Check for updates every 5 minutes
        setInterval(() => {
          registration.update();
        }, 5 * 60 * 1000);

        // Listen for new SW waiting to activate
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New version available
              setUpdateAvailable(true);
              toast(
                'Versi baru tersedia! Tap untuk kemaskini.',
                {
                  duration: 8000,
                  icon: '🆕',
                  style: { cursor: 'pointer' },
                }
              );
            }
          });
        });
      })
      .catch((error) => {
        console.error('[SW] Registration failed:', error);
      });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Reload to use new cached assets
      window.location.reload();
    });
  }, []);

  // Update button (hidden, triggered by toast tap)
  useEffect(() => {
    if (!updateAvailable) return;

    const handleClick = () => {
      navigator.serviceWorker.ready.then((registration) => {
        if (registration.waiting) {
          registration.waiting.postMessage('SKIP_WAITING');
        }
      });
    };

    // Listen for toast click
    document.addEventListener('click', handleClick, { once: true });
    return () => document.removeEventListener('click', handleClick);
  }, [updateAvailable]);

  return null;
}
