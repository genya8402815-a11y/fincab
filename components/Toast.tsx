'use client';

import { useEffect, useState } from 'react';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | '';
  onHide: () => void;
}

export default function Toast({ message, type, onHide }: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const hide = setTimeout(() => setVisible(false), 2800);
    const clear = setTimeout(() => onHide(), 3200);
    return () => { clearTimeout(hide); clearTimeout(clear); };
  }, [message, onHide]);

  if (!message) return null;

  const bg = type === 'success' ? '#166534' : '#7f1d1d';
  const border = type === 'success' ? '#4ade80' : '#f87171';
  const icon = type === 'success' ? '✅' : '❌';

  return (
    <div style={{
      position: 'fixed',
      bottom: 32,
      left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '80px'})`,
      opacity: visible ? 1 : 0,
      transition: 'transform .3s ease, opacity .3s ease',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 14,
      padding: '14px 24px',
      fontSize: 15,
      fontWeight: 600,
      color: '#fff',
      zIndex: 9999,
      whiteSpace: 'nowrap',
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      pointerEvents: 'none',
    }}>
      {icon} {message}
    </div>
  );
}
