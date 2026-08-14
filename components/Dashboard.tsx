'use client';

import { useEffect, useState } from 'react';

interface DashData { month: string; year: string; balance: string; salary: string; debt: string; savings: string; pace: string[][]; }
interface Goal { name: string; saved: string; need: string; left: string; percent: string; }
interface Debt { name: string; initial: string; paid: string; left: string; }

function n(v?: string) { return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.').replace('₽','')) || 0; }
function fmt(v?: string) { return n(v).toLocaleString('ru-RU') + ' ₽'; }

const C = { green: '#4ade80', blue: '#6c8ef7', red: '#f87171', yellow: '#fbbf24', orange: '#fb923c', purple: '#a78bfa', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535' };

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

export default function Dashboard() {
  const [dash,  setDash]  = useState<DashData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/goals').then(r => r.json()),
      fetch('/api/debts').then(r => r.json()),
    ]).then(([d, g, db]) => { setDash(d); setGoals(g.goals ?? []); setDebts(db.debts ?? []); setLoading(false); })
    .catch(() => setLoading(false));
  }, []);

  if (loading || !dash) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;

  const GOAL_COLORS = [C.green, C.blue, C.yellow, C.orange, C.purple];
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const cardTitle = { fontSize: 12, fontWeight: 600 as const, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: 16 };
  const row = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      <div className="grid-4">
        <KPI color={C.green}  icon="💵" label="Остаток на счёте"  value={fmt(dash.balance)} />
        <KPI color={C.blue}   icon="📊" label="Зарплата (расчёт)" value={fmt(dash.salary)}  sub={`${dash.month} ${dash.year}`} />
        <KPI color={C.red}    icon="💳" label="Общий долг"        value={fmt(dash.debt)}    sub={`${debts.length} долгов`} />
        <KPI color={C.yellow} icon="🎯" label="Накопления"        value={fmt(dash.savings)} sub={`${goals.length} целей`} />
      </div>

      <div className="grid-2-1">
        <div style={card}>
          <div style={cardTitle}>📈 Трекер темпа · {dash.month} {dash.year}</div>
          {dash.pace?.length > 0 ? dash.pace.map((r, i) => (
            <div key={i} style={{ ...row, ...(i === dash.pace.length - 1 ? { borderBottom: 'none' } : {}) }}>
              <span style={{ color: C.sub }}>{r[0] ? `${r[0]} · ${r[1]}` : r[1]}</span>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: C.sub }}>факт: {r[3]} · план: {r[2]}</span>
                <span style={{ fontSize: 13 }}>{r[r.length - 1]}</span>
              </div>
            </div>
          )) : <span style={{ color: C.sub, fontSize: 13 }}>Нет данных</span>}
        </div>

        <div style={card}>
          <div style={cardTitle}>💳 Долги — остаток</div>
          {debts.map((d, i) => (
            <div key={i} style={{ ...row, ...(i === debts.length - 1 ? { borderBottom: 'none' } : {}) }}>
              <span style={{ fontSize: 13 }}>{d.name}</span>
              <span style={{ color: n(d.left) === 0 ? C.green : C.red, fontWeight: 600, fontSize: 13 }}>
                {n(d.left) === 0 ? '0 ₽ ✅' : fmt(d.left)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {goals.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>🎯 Цели — прогресс</div>
          <div className="grid-goals">
            {goals.map((g, i) => {
              const pct = Math.min(parseFloat(g.percent) || 0, 100);
              const c = GOAL_COLORS[i % GOAL_COLORS.length];
              return (
                <div key={i} style={{ paddingBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span>{g.name}</span>
                    <span style={{ color: C.sub }}>{fmt(g.saved)} / {fmt(g.need)} · {pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 3, background: c, width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
