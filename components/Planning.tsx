'use client';

import { useState } from 'react';
import Goals from './Goals';
import Debts from './Debts';

type SubTab = 'goals' | 'debts';

const C = { accent: '#6c8ef7', sub: '#8892a4', border: '#2d3148', surface2: '#222535' };

export default function Planning() {
  const [sub, setSub] = useState<SubTab>('goals');
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: C.surface2, borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([
          { id: 'goals' as SubTab, label: '🎯 Цели' },
          { id: 'debts' as SubTab, label: '💳 Долги' },
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
      {sub === 'goals' && <Goals />}
      {sub === 'debts' && <Debts />}
    </div>
  );
}
