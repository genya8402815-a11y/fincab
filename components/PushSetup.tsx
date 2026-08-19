'use client';

import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export default function PushSetup() {
  const [status, setStatus] = useState<'idle' | 'subscribed' | 'denied' | 'unsupported' | 'loading'>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    const perm = Notification.permission;
    if (perm === 'granted') setStatus('subscribed');
    else if (perm === 'denied') setStatus('denied');
  }, []);

  async function subscribe() {
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setStatus('subscribed');
    } catch (e) {
      console.error(e);
      setStatus('idle');
    }
  }

  if (status === 'unsupported' || status === 'subscribed') return null;

  if (status === 'denied') return (
    <p style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '8px 0' }}>
      Уведомления заблокированы — разреши в настройках браузера
    </p>
  );

  return (
    <button
      onClick={subscribe}
      disabled={status === 'loading'}
      style={{
        display: 'block',
        width: '100%',
        padding: '12px',
        margin: '0 0 16px',
        background: 'rgba(108, 99, 255, 0.15)',
        border: '1px solid rgba(108, 99, 255, 0.4)',
        borderRadius: 10,
        color: '#a89fff',
        fontSize: 14,
        cursor: 'pointer',
        textAlign: 'center',
      }}
    >
      {status === 'loading' ? 'Подключаем...' : '🔔 Включить напоминания в 23:00'}
    </button>
  );
}
