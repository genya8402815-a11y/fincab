'use client';

import { useEffect, useState } from 'react';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  if (!offline) return null;

  return (
    <div style={{
      position: 'fixed', top: 60, left: 0, right: 0, zIndex: 200,
      background: '#92400e', color: '#fef3c7',
      textAlign: 'center', padding: '8px 16px', fontSize: 13,
    }}>
      📵 Офлайн — показаны данные из кеша, изменения не сохранятся
    </div>
  );
}
