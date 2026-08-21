'use client';

import { useEffect, useState, useCallback } from 'react';
import { useJournal } from '@/lib/useJournal';

interface DashData { month: string; year: string; balance: string; salary: string; debt: string; savings: string; pace: string[][]; }
interface Goal     { name: string; saved: string; need: string; left: string; percent: string; }
interface Debt     { name: string; initial: string; paid: string; left: string; }
interface Regular  { rowIndex: number; name: string; day: string; amount: string; category: string; paid: boolean; }

function n(v?: string) { return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.').replace('₽','')) || 0; }
function fmt(v?: string | number) {
  const num = typeof v === 'number' ? v : n(String(v));
  return num.toLocaleString('ru-RU') + ' ₽';
}

const C = {
  green: '#4ade80', blue: '#6c8ef7', red: '#f87171', yellow: '#fbbf24',
  orange: '#fb923c', purple: '#a78bfa', sub: '#8892a4', border: '#2d3148',
  surface: '#1a1d27', surface2: '#222535',
};

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
  const [dash,     setDash]     = useState<DashData | null>(null);
  const [goals,    setGoals]    = useState<Goal[]>([]);
  const [debts,    setDebts]    = useState<Debt[]>([]);
  const [regulars, setRegulars] = useState<Regular[]>([]);
  const [unpaidAmt, setUnpaidAmt] = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [toggling, setToggling] = useState<number | null>(null);
  const { entries, loading: journalLoading } = useJournal();

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard').then(r => r.json()),
      fetch('/api/goals').then(r => r.json()),
      fetch('/api/debts').then(r => r.json()),
      fetch('/api/regulars').then(r => r.json()),
    ]).then(([d, g, db, reg]) => {
      setDash(d);
      setGoals(g.goals ?? []);
      setDebts(db.debts ?? []);
      setRegulars(reg.items ?? []);
      setUnpaidAmt(reg.unpaidAmt ?? 0);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const togglePaid = useCallback(async (rowIndex: number) => {
    setToggling(rowIndex);
    try {
      const res = await fetch(`/api/regulars/${rowIndex}`, { method: 'PATCH' });
      const data = await res.json();
      setRegulars(prev => prev.map(r => r.rowIndex === rowIndex ? { ...r, paid: data.paid } : r));
      setUnpaidAmt(prev => {
        const reg = regulars.find(r => r.rowIndex === rowIndex);
        if (!reg) return prev;
        return data.paid ? prev - n(reg.amount) : prev + n(reg.amount);
      });
    } catch { /* silent */ }
    finally { setToggling(null); }
  }, [regulars]);

  if (loading || !dash) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;

  // --- KPI computations ---
  const freeAmt = n(dash.balance) - unpaidAmt;
  const freeColor = freeAmt >= 0 ? C.orange : C.red;

  const totalRegulars = regulars.reduce((s, r) => s + n(r.amount), 0);
  const salary = n(dash.salary);
  const dti = salary > 0 ? Math.round((totalRegulars / salary) * 100) : 0;
  const dtiColor = dti <= 20 ? C.green : dti <= 35 ? C.yellow : dti <= 50 ? C.orange : C.red;
  const dtiLabel = dti <= 20 ? 'отлично' : dti <= 35 ? 'умеренно' : dti <= 50 ? 'высокая' : '⚠️ опасно';

  const nowDate = new Date();
  const monthlyExp = new Map<string, number>();
  entries.forEach(e => {
    if (e.type !== 'Расход') return;
    const p = e.date.split('.');
    if (p.length < 3) return;
    const yr = parseInt(p[2], 10), mo = parseInt(p[1], 10) - 1;
    if (yr === nowDate.getFullYear() && mo === nowDate.getMonth()) return; // skip current month
    const key = `${p[1]}.${p[2]}`;
    monthlyExp.set(key, (monthlyExp.get(key) ?? 0) + n(e.amount));
  });
  const recentMonths = Array.from(monthlyExp.entries())
    .sort((a, b) => b[0].localeCompare(a[0])).slice(0, 3);
  const avgExpenses3m = recentMonths.length > 0
    ? recentMonths.reduce((s, [, v]) => s + v, 0) / recentMonths.length : 0;
  const coverage = avgExpenses3m > 0 ? n(dash.balance) / avgExpenses3m : 0;
  const coverageColor = coverage >= 6 ? C.green : coverage >= 3 ? C.yellow : coverage >= 1 ? C.orange : C.red;
  const coverageLabel = coverage >= 6 ? 'отлично' : coverage >= 3 ? 'норма' : coverage >= 1 ? 'маловато' : '⚠️ мало';
  // -------------------------

  const GOAL_COLORS = [C.green, C.blue, C.yellow, C.orange, C.purple];
  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const cardTitle = { fontSize: 12, fontWeight: 600 as const, color: C.sub, textTransform: 'uppercase' as const, letterSpacing: '.5px', marginBottom: 16 };
  const row  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 };

  // Скрываем хелперные строки (initial=0) и выплаченные долги (left=0)
  const activeDebts     = debts.filter(d => n(d.initial) > 0 && n(d.left) > 0);
  // Скрываем регулярные без суммы
  const visibleRegulars = regulars.filter(r => n(r.amount) > 0);
  const unpaidCount     = visibleRegulars.filter(r => !r.paid).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI — row 1: Остаток, Зарплата, Свободно, Долг | row 2: Накопления, DTI, Подушка */}
      <div className="grid-4">
        <KPI color={C.green}   icon="💵" label="Остаток на счёте"       value={fmt(dash.balance)} />
        <KPI color={C.blue}    icon="📊" label="Зарплата (расчёт)"      value={fmt(dash.salary)}  sub={`${dash.month} ${dash.year}`} />
        <KPI color={freeColor} icon="✅" label="Свободно (после обяз.)" value={fmt(Math.abs(freeAmt))} sub={freeAmt < 0 ? '⚠️ Не хватает' : `неопл. ${fmt(unpaidAmt)}`} />
        <KPI color={C.red}     icon="💳" label="Общий долг"             value={fmt(dash.debt)}    sub={`${activeDebts.length} долгов`} />
        <KPI color={C.yellow}  icon="🎯" label="Накопления"             value={fmt(dash.savings)} sub={`${goals.length} целей`} />
        <KPI color={salary > 0 ? dtiColor : C.sub} icon="📉" label="Нагрузка / Доход" value={salary > 0 ? `${dti}%` : '—'} sub={salary > 0 ? dtiLabel : 'нет данных'} />
        <KPI
          color={journalLoading ? C.sub : avgExpenses3m > 0 ? coverageColor : C.sub}
          icon="🛡️"
          label="Подушка (мес.)"
          value={journalLoading ? '…' : avgExpenses3m > 0 ? coverage.toFixed(1) : '—'}
          sub={journalLoading ? 'загрузка…' : avgExpenses3m > 0 ? `${coverageLabel} · ср. ${fmt(Math.round(avgExpenses3m))}/мес` : 'нет данных'}
        />
      </div>

      {/* Трекер + Долги + Регулярные */}
      <div className="grid-2-1">
        {/* Трекер темпа */}
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

        {/* Правая колонка: Долги + Регулярные */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Долги */}
          <div style={card}>
            <div style={cardTitle}>💳 Долги — остаток</div>
            {activeDebts.length === 0
              ? <span style={{ color: C.green, fontSize: 13 }}>✅ Все долги выплачены</span>
              : activeDebts.map((d, i) => (
                <div key={i} style={{ ...row, ...(i === activeDebts.length - 1 ? { borderBottom: 'none' } : {}) }}>
                  <span style={{ fontSize: 13 }}>{d.name}</span>
                  <span style={{ color: C.red, fontWeight: 600, fontSize: 13 }}>{fmt(d.left)}</span>
                </div>
              ))
            }
          </div>

          {/* Регулярные платежи */}
          {visibleRegulars.length > 0 && (
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={cardTitle}>🔁 Регулярные платежи</div>
                {unpaidCount > 0 && (
                  <span style={{ fontSize: 12, color: C.red, fontWeight: 600, background: '#7f1d1d22', padding: '3px 8px', borderRadius: 6 }}>
                    -{fmt(unpaidAmt)}
                  </span>
                )}
              </div>
              {visibleRegulars.map((reg, i) => {
                const isLast = i === visibleRegulars.length - 1;
                const isToggling = toggling === reg.rowIndex;
                return (
                  <div key={reg.rowIndex} style={{ ...row, ...(isLast ? { borderBottom: 'none' } : {}), opacity: isToggling ? .5 : 1 }}>
                    <div>
                      <span style={{ fontSize: 13, color: reg.paid ? C.sub : '#e2e8f0', textDecoration: reg.paid ? 'line-through' : 'none' }}>
                        {reg.name}
                      </span>
                      {reg.day && <span style={{ fontSize: 11, color: C.sub, marginLeft: 6 }}>{reg.day}-го</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: reg.paid ? C.sub : C.red }}>
                        {fmt(reg.amount)}
                      </span>
                      <button
                        onClick={() => !isToggling && togglePaid(reg.rowIndex)}
                        title={reg.paid ? 'Отметить как неоплаченное' : 'Отметить как оплаченное'}
                        style={{
                          width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                          border: `2px solid ${reg.paid ? C.green : C.border}`,
                          background: reg.paid ? C.green : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, flexShrink: 0,
                          transition: 'all .15s',
                        }}
                      >
                        {reg.paid ? '✓' : ''}
                      </button>
                    </div>
                  </div>
                );
              })}
              {unpaidCount === 0 && (
                <div style={{ fontSize: 12, color: C.green, textAlign: 'center', paddingTop: 8 }}>
                  ✅ Все оплачено в этом месяце
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Цели */}
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
