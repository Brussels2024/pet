'use client';

import { useEffect } from 'react';

export default function AdminSessionKeepAlive() {
  useEffect(() => {
    let lastRefresh = 0;
    let busy = false;
    const refresh = async () => {
      const now = Date.now();
      if (busy || now - lastRefresh < 10 * 60 * 1000) return;
      busy = true;
      try {
        const response = await fetch('/api/admin/session', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
          cache: 'no-store',
        });
        if (response.ok) lastRefresh = now;
      } catch {}
      finally { busy = false; }
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((event) => window.addEventListener(event, refresh, { passive: true }));
    refresh();
    return () => events.forEach((event) => window.removeEventListener(event, refresh));
  }, []);
  return null;
}
