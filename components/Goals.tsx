'use client';

import { useEffect, useState } from 'react';

interface Goal {
  name: string;
  saved: string;
  need: string;
  left: string;
  percent: string;
  date: string;
}

const C = {
  green: '#4ade80', blue: '#6c8ef7', yellow: '#fbbf24', orange: '#fb923c',
  red: '#f87171', purple: '#c084fc', sub: '#8892a4', border: '#2d3148',
  surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0',
};

const GOAL_COLORS = [C.blue, C.green, C.yellow, C.orange, C.purple, C.red];

function n(v?: string) { return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.')) || 0; }
function money(v: number) { return v.toLocaleString('ru-RU') + ' ₽'; }

// DD.MM.YYYY → месяцев до даты
function monthsUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const parts = dateStr.split('.');
  if (parts.length < 3) return null;
  const target = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  const now = new Date();
  const diff = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return diff > 0 ? diff : 0;
}

function KPI({ color, icon, label, value, sub }: { color: string; icon: string; label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function Goals() {
  const [goals,   setGoals]   = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/goals').then(r => r.json())
      .then(d => { setGoals(d.goals ?? []); setLoading(false); })
      .catch(() => { setError('Ошибка загрузки'); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ color: C.red, padding: 24 }}>{error}</div>;

  const totalNeed  = goals.reduce((s, g) => s + n(g.need), 0);
  const totalSaved = goals.reduce((s, g) => s + n(g.saved), 0);
  const totalLeft  = goals.reduce((s, g) => s + n(g.left), 0);
  const avgPct     = goals.length > 0 ? goals.reduce((s, g) => s + n(g.percent), 0) / goals.length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div className="grid-3">
        <KPI color={C.blue}   icon="🎯" label="Всего целей"     value={`${goals.length} шт`} sub={money(totalNeed)} />
        <KPI color={C.green}  icon="✅" label="Уже накоплено"   value={money(totalSaved)} />
        <KPI color={C.yellow} icon="📊" label="Средний прогресс" value={`${avgPct.toFixed(0)}%`} sub={`осталось ${money(totalLeft)}`} />
      </div>

      {/* Карточки целей */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {goals.map((g, i) => {
          const saved   = n(g.saved);
          const need    = n(g.need);
          const left    = n(g.left);
          const pct     = Math.min(n(g.percent), 100);
          const color   = GOAL_COLORS[i % GOAL_COLORS.length];
          const months  = monthsUntil(g.date);
          const perMonth = months && months > 0 ? Math.ceil(left / months) : null;
          const done    = left <= 0;

          return (
            <div key={i} style={{
              background: C.surface, border: `1px solid ${done ? C.green : C.border}`,
              borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />

              {/* Название */}
              <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
                {g.name} {done ? '✅' : ''}
              </div>

              {/* Дата */}
              {g.date && (
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>
                  📅 {g.date}{months !== null ? ` · ${months} мес.` : ''}
                </div>
              )}

              {/* Прогресс-бар */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.sub, marginBottom: 6 }}>
                  <span>{money(saved)}</span>
                  <span style={{ fontWeight: 600, color }}>{pct.toFixed(0)}%</span>
                  <span>{money(need)}</span>
                </div>
                <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: done ? C.green : color,
                    width: `${pct}%`, transition: 'width .5s ease',
                  }} />
                </div>
              </div>

              {/* Детали */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!done && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.sub }}>Осталось</span>
                    <span style={{ fontWeight: 600, color: C.orange }}>{money(left)}</span>
                  </div>
                )}
                {perMonth && !done && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span style={{ color: C.sub }}>В месяц</span>
                    <span style={{ fontWeight: 600, color }}>{money(perMonth)}</span>
                  </div>
                )}
                {done && (
                  <div style={{ textAlign: 'center', color: C.green, fontWeight: 700, fontSize: 14 }}>
                    Цель достигнута! 🎉
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
