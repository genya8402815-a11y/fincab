'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setError('Неверный пароль');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#1a1d27', border: '1px solid #2d3148', borderRadius: 20,
        padding: 40, width: '100%', maxWidth: 360,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>💰</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#e2e8f0' }}>ФИНКАБ</div>
          <div style={{ fontSize: 14, color: '#8892a4', marginTop: 6 }}>Введите пароль для входа</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Пароль"
            autoFocus
            style={{
              background: '#222535', border: '1px solid #2d3148', borderRadius: 10,
              padding: '14px 16px', color: '#e2e8f0', fontSize: 16, outline: 'none',
              width: '100%', boxSizing: 'border-box',
            }}
          />

          {error && (
            <div style={{ color: '#f87171', fontSize: 14, textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            style={{
              background: '#6c8ef7', border: 'none', borderRadius: 10,
              padding: '14px', color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: loading || !password ? 'not-allowed' : 'pointer',
              opacity: !password ? 0.5 : 1,
              transition: 'opacity .2s',
            }}
          >
            {loading ? 'Вхожу...' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
