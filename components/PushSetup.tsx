'use client';

import { useEffect, useState } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

type Status = 'idle' | 'subscribed' | 'denied' | 'unsupported' | 'loading';

export default function PushSetup() {
  const [status, setStatus] = useState<Status>('idle');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported'); return;
    }
    const perm = Notification.permission;
    if (perm === 'denied') { setStatus('denied'); return; }
    // Проверяем есть ли уже активная подписка на этом устройстве
    navigator.serviceWorker.ready.then(reg =>
      reg.pushManager.getSubscription().then(sub => {
        setStatus(sub ? 'subscribed' : 'idle');
      })
    ).catch(() => setStatus('idle'));
  }, []);

  async function subscribe() {
    setStatus('loading');
    const timer = (ms: number) => new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms));
    try {
      const reg = await Promise.race([navigator.serviceWorker.ready, timer(8000)]);
      const sub = await Promise.race([
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }),
        timer(10000),
      ]);
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub),
      });
      setStatus('subscribed');
    } catch (e) {
      console.error('push subscribe error:', e);
      setStatus('idle');
    }
  }

  async function unsubscribe() {
    setStatus('loading');
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus('idle');
    } catch (e) {
      console.error(e);
      setStatus('subscribed');
    }
  }

  if (status === 'unsupported') return null;

  if (status === 'denied') return (
    <p style={{ fontSize: 12, color: '#888', textAlign: 'center', padding: '8px 0' }}>
      Уведомления заблокированы — разреши в настройках браузера
    </p>
  );

  if (status === 'subscribed') return (
    <button
      onClick={unsubscribe}
      style={{
        display: 'block', width: '100%', padding: '10px',
        margin: '0 0 16px',
        background: 'rgba(74, 222, 128, 0.1)',
        border: '1px solid rgba(74, 222, 128, 0.3)',
        borderRadius: 10, color: '#4ade80', fontSize: 13, cursor: 'pointer', textAlign: 'center',
      }}
    >
      🔔 Уведомления включены · Отключить
    </button>
  );

  return (
    <button
      onClick={subscribe}
      disabled={status === 'loading'}
      style={{
        display: 'block', width: '100%', padding: '12px',
        margin: '0 0 16px',
        background: 'rgba(108, 99, 255, 0.15)',
        border: '1px solid rgba(108, 99, 255, 0.4)',
        borderRadius: 10, color: '#a89fff', fontSize: 14, cursor: 'pointer', textAlign: 'center',
      }}
    >
      {status === 'loading' ? 'Подключаем...' : '🔔 Включить напоминания в 23:00'}
    </button>
  );
}
