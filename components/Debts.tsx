'use client';

import { useEffect, useState } from 'react';

interface Debt { name: string; initial: string; paid: string; left: string; }

const C = { green: '#4ade80', blue: '#6c8ef7', red: '#f87171', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535' };

function n(v?: string) { return parseFloat(String(v??'0').replace(/\s/g,'').replace(',','.').replace('₽','')) || 0; }
function money(v?: string) { return n(v).toLocaleString('ru-RU') + ' ₽'; }

function KPI({ color, icon, label, value, sub }: { color: string; icon: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Debts() {
  const [debts,   setDebts]   = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/debts').then(r => r.json())
      .then(d => { setDebts(d.debts ?? []); setLoading(false); })
      .catch(() => { setError('Ошибка загрузки'); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ color: C.red, padding: 24 }}>{error}</div>;

  const totalDebt = debts.reduce((s, d) => s + n(d.left), 0);
  const totalPaid = debts.reduce((s, d) => s + n(d.paid), 0);
  const totalInit = debts.reduce((s, d) => s + n(d.initial), 0);
  const overallPct = totalInit > 0 ? Math.min((totalPaid / totalInit) * 100, 100) : 0;

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const cardTitle = { fontSize: 12, fontWeight: 600 as const, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: 16 };
  const th = (right?: boolean) => ({ textAlign: right ? 'right' as const : 'left' as const, padding: '8px 12px', color: C.sub, fontWeight: 600, fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '.5px', borderBottom: `1px solid ${C.border}` });
  const td = (right?: boolean) => ({ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, textAlign: right ? 'right' as const : 'left' as const, verticalAlign: 'middle' as const });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        <KPI color={C.red}   icon="💳" label="Осталось выплатить" value={`${totalDebt.toLocaleString('ru-RU')} ₽`} />
        <KPI color={C.green} icon="✅" label="Уже выплачено"      value={`${totalPaid.toLocaleString('ru-RU')} ₽`} />
        <KPI color={C.blue}  icon="📊" label="Общий прогресс"     value={`${overallPct.toFixed(0)}%`} sub={`из ${totalInit.toLocaleString('ru-RU')} ₽`} />
      </div>

      <div style={card}>
        <div style={cardTitle}>💳 Все долги</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th()}>Название</th>
              <th style={th(true)}>Изначально</th>
              <th style={th(true)}>Выплачено</th>
              <th style={th(true)}>Осталось</th>
              <th style={th()}>Прогресс</th>
            </tr>
          </thead>
          <tbody>
            {debts.map((d, i) => {
              const ini  = n(d.initial);
              const paid = n(d.paid);
              const left = n(d.left);
              const pct  = ini > 0 ? Math.min((paid / ini) * 100, 100) : 0;
              const isLast = i === debts.length - 1;
              const tdS = (right?: boolean) => ({ ...td(right), ...(isLast ? { borderBottom: 'none' } : {}) });
              return (
                <tr key={i}>
                  <td style={{ ...tdS(), fontWeight: 500 }}>{d.name}</td>
                  <td style={{ ...tdS(true), color: C.sub }}>{money(d.initial)}</td>
                  <td style={{ ...tdS(true), color: C.green }}>{money(d.paid)}</td>
                  <td style={{ ...tdS(true), color: left === 0 ? C.green : C.red, fontWeight: 600 }}>
                    {left === 0 ? '0 ₽ ✅' : money(d.left)}
                  </td>
                  <td style={tdS()}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: left === 0 ? C.green : C.blue, width: `${pct}%` }} />
                      </div>
                      <span style={{ fontSize: 12, color: C.sub, minWidth: 34, textAlign: 'right' }}>{pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
