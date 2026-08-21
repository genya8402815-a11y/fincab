'use client';

import { useState } from 'react';
import Analytics from './Analytics';
import Budget    from './Budget';

type SubTab = 'analytics' | 'budget';

const C = { accent: '#6c8ef7', sub: '#8892a4', border: '#2d3148', surface2: '#222535' };

export default function Finance() {
  const [sub, setSub] = useState<SubTab>('analytics');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: C.surface2, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([
          { id: 'analytics' as SubTab, label: '📈 Аналитика' },
          { id: 'budget'    as SubTab, label: '💡 Бюджет' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            style={{
              padding: '7px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, transition: '.15s',
              background: sub === t.id ? C.accent : 'transparent',
              color:      sub === t.id ? '#fff'   : C.sub,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'analytics' && <Analytics />}
      {sub === 'budget'    && <Budget />}
    </div>
  );
}
