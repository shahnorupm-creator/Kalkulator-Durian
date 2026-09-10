'use client';

import { useEffect, useState } from 'react';
import { tarikhMalaysia } from '@/lib/unjuran';

/** Tarikh kalendar Malaysia yang dikemas kini automatik apabila hari bertukar. */
export function useTarikhSemasa(): string {
  const [tarikh, setTarikh] = useState(() => tarikhMalaysia());

  useEffect(() => {
    const kemasKini = () => setTarikh(semasa => {
      const baharu = tarikhMalaysia();
      return semasa === baharu ? semasa : baharu;
    });
    kemasKini();
    const interval = window.setInterval(kemasKini, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return tarikh;
}
