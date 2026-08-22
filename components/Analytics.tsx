'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useJournal, type JournalEntry as Entry } from '@/lib/useJournal';

const C = {
  green: '#4ade80', red: '#f87171', blue: '#6c8ef7', yellow: '#fbbf24',
  sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0',
};

const PALETTE = [
  '#6c8ef7','#4ade80','#fbbf24','#f87171','#c084fc',
  '#fb923c','#34d399','#f472b6','#a3e635','#38bdf8','#818cf8','#e879f9',
];

const RU_MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                   'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function parseDateKey(date: string) {
  const p = date.split('.');
  if (p.length < 3) return null;
  const m = parseInt(p[1]) - 1;
  return { key: `${p[1]}.${p[2]}`, label: `${RU_MONTHS[m]} ${p[2]}` };
}

function n(v: string) { return parseFloat(String(v || '0').replace(/\s/g, '').replace(',', '.')) || 0; }
function money(v: number) { return Math.abs(v).toLocaleString('ru-RU') + ' ₽'; }

function prevMonthKey(key: string): string {
  const [mm, yyyy] = key.split('.');
  const d = new Date(parseInt(yyyy), parseInt(mm) - 2, 1);
  return `${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function Delta({ cur, prev }: { cur: number; prev: number }) {
  if (prev === 0) return <span style={{ color: '#8892a4', fontSize: 11 }}>new</span>;
  const pct = ((cur - prev) / prev) * 100;
  const up  = pct > 0;
  const color = up ? '#f87171' : '#4ade80'; // расходы: рост = плохо (красный), падение = хорошо (зелёный)
  return (
    <span style={{ color, fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>
      {up ? '↑' : '↓'} {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

function KpiDelta({ cur, prev, inverse = false }: { cur: number; prev: number; inverse?: boolean }) {
  if (prev === 0 || cur === prev) return null;
  const pct = ((cur - prev) / prev) * 100;
  const up  = pct > 0;
  // inverse=true → рост хорошо (доходы); inverse=false → рост плохо (расходы)
  const color = (inverse ? up : !up) ? '#4ade80' : '#f87171';
  return (
    <span style={{ fontSize: 11, color, marginLeft: 4 }}>
      {up ? '↑' : '↓'}{Math.abs(pct).toFixed(0)}%
    </span>
  );
}

// SVG donut chart
function Donut({ segs, center }: { segs: { color: string; pct: number }[]; center: string }) {
  const r = 68, circ = 2 * Math.PI * r;
  let cum = 0;
  return (
    <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={r} fill="none" stroke={C.surface2} strokeWidth="22" />
        <g transform="rotate(-90, 90, 90)">
          {segs.map((s, i) => {
            if (s.pct <= 0) return null;
            const len = (s.pct / 100) * circ;
            const off = -(cum / 100) * circ;
            cum += s.pct;
            return (
              <circle key={i} cx="90" cy="90" r={r} fill="none"
                stroke={s.color} strokeWidth="22"
                strokeDasharray={`${len} ${circ}`} strokeDashoffset={off} />
            );
          })}
        </g>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 11, color: C.sub, marginBottom: 2 }}>Расходы</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.text, textAlign: 'center', maxWidth: 90 }}>{center}</span>
      </div>
    </div>
  );
}

function KPI({ color, icon, label, value, sub }: { color: string; icon: string; label: string; value: string; sub?: React.ReactNode }) {
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

export default function Analytics() {
  const { entries, loading, error } = useJournal();
  const [selMonth, setSelMonth] = useState('');
  const monthInitRef = useRef(false);

  // Инициализируем текущий месяц при первом появлении данных
  useEffect(() => {
    if (!loading && !monthInitRef.current && entries.length > 0) {
      monthInitRef.current = true;
      const now = new Date();
      const cur = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
      setSelMonth(entries.some(e => parseDateKey(e.date)?.key === cur) ? cur : '');
    }
  }, [loading, entries]);

  // ДОБАВЛЕНО (22.08.2026, P3 #30) — Burn Rate: постоянные vs переменные траты.
  // "Постоянные" — это то, что уходит без выбора в этом месяце: сумма всех
  // регулярных платежей + месячные платежи по долгам (та же цифра, что и в
  // DTI-карточке на дашборде, — чтобы не считать одно и то же дважды разными
  // способами). Это "живая" цифра текущих обязательств, а не за выбранный
  // период — регулярные платежи и долги не хранят историю по месяцам.
  // "Переменные" — фактические траты за выбранный период по категориям,
  // НЕ помеченным как "Фикс" в листе «⚙ Категории» (столбец E) — то, чем
  // реально можно управлять день ото дня.
  const [expenseTypes, setExpenseTypes] = useState<Record<string, 'fixed' | 'variable'>>({});
  const [fixedBurn, setFixedBurn] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const [catsRes, regRes, debtsRes] = await Promise.all([
          fetch('/api/categories').then(r => r.json()),
          fetch('/api/regulars').then(r => r.json()),
          fetch('/api/debts').then(r => r.json()),
        ]);
        setExpenseTypes(catsRes.expenseTypes || {});
        const regularsTotal = n(String(regRes?.total ?? 0));
        const debtsMonthly = (debtsRes?.debts || [])
          .filter((d: { left: string }) => n(d.left) > 0)
          .reduce((s: number, d: { monthly: string }) => s + n(d.monthly), 0);
        setFixedBurn(regularsTotal + debtsMonthly);
      } catch { /* нет доступа к листам — оставляем 0, карточка просто не покажет ничего критичного */ }
    })();
  }, []);

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ color: C.red, padding: 24 }}>{error}</div>;

  const months = Array.from(
    new Map(entries.map(e => { const p = parseDateKey(e.date); return p ? [p.key, p.label] : null; }).filter(Boolean) as [string,string][])
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const byMonth = selMonth ? entries.filter(e => parseDateKey(e.date)?.key === selMonth) : entries;

  const income  = byMonth.filter(e => e.type === 'Доход').reduce((s, e) => s + n(e.amount), 0);
  const expense = byMonth.filter(e => e.type === 'Расход').reduce((s, e) => s + n(e.amount), 0);
  const balance = income - expense;
  // ИСПРАВЛЕНИЕ (22.08.2026): раньше saveRate = (доход − расход) / доход — это
  // "сколько от дохода не потрачено", а не реально отложенные деньги (остаток
  // мог просто лежать на счету, а не быть переведён в накопления). Теперь считаем
  // только настоящие переводы «В накопления» за месяц — честная норма сбережений.
  const savedToGoals = byMonth.filter(e => e.type === 'В накопления').reduce((s, e) => s + n(e.amount), 0);
  const saveRate = income > 0 ? (savedToGoals / income * 100) : 0;

  // Burn Rate (P3 #30): переменные траты за выбранный период — расходы по
  // категориям, не помеченным «Фикс» (не тегированная категория = переменная,
  // безопасный дефолт). Долги/регулярные сюда не входят — они уже в fixedBurn.
  const variableBurn = byMonth
    .filter(e => e.type === 'Расход' && expenseTypes[e.category || 'Прочее'] !== 'fixed')
    .reduce((s, e) => s + n(e.amount), 0);
  let variableBurnSub: string;
  if (selMonth) {
    const [mm, yyyy] = selMonth.split('.').map(Number);
    const now = new Date();
    const isCurrentMonth = now.getMonth() + 1 === mm && now.getFullYear() === yyyy;
    const totalDays = new Date(yyyy, mm, 0).getDate();
    const elapsedDays = isCurrentMonth ? now.getDate() : totalDays;
    variableBurnSub = elapsedDays > 0 ? `≈ ${money(variableBurn / elapsedDays)}/день` : 'за месяц';
  } else {
    variableBurnSub = 'за всё время';
  }

  // Расходы по категориям
  const catMap = new Map<string, { amount: number; count: number }>();
  byMonth.filter(e => e.type === 'Расход').forEach(e => {
    const cat = e.category || 'Прочее';
    const ex = catMap.get(cat) ?? { amount: 0, count: 0 };
    catMap.set(cat, { amount: ex.amount + n(e.amount), count: ex.count + 1 });
  });
  const cats = Array.from(catMap.entries())
    .map(([name, { amount, count }], i) => ({
      name, amount, count,
      color: PALETTE[i % PALETTE.length],
      pct: expense > 0 ? (amount / expense * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // Данные предыдущего месяца (только при выбранном месяце)
  const prevKey    = selMonth ? prevMonthKey(selMonth) : null;
  const prevByMonth = prevKey ? entries.filter(e => parseDateKey(e.date)?.key === prevKey) : [];
  const prevIncome  = prevByMonth.filter(e => e.type === 'Доход').reduce((s, e) => s + n(e.amount), 0);
  const prevExpense = prevByMonth.filter(e => e.type === 'Расход').reduce((s, e) => s + n(e.amount), 0);
  const prevCatMap  = new Map<string, number>();
  prevByMonth.filter(e => e.type === 'Расход').forEach(e => {
    const cat = e.category || 'Прочее';
    prevCatMap.set(cat, (prevCatMap.get(cat) ?? 0) + n(e.amount));
  });

  // Тренд: последние 6 месяцев
  const last6 = months.slice(0, 6).reverse();
  const maxBar = Math.max(1, ...last6.map(([key]) => {
    const me = entries.filter(e => parseDateKey(e.date)?.key === key);
    const inc = me.filter(e => e.type === 'Доход').reduce((s, e) => s + n(e.amount), 0);
    const exp = me.filter(e => e.type === 'Расход').reduce((s, e) => s + n(e.amount), 0);
    return Math.max(inc, exp);
  }));

  const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const thS: React.CSSProperties = {
    textAlign: 'right', padding: '6px 8px', color: C.sub, fontWeight: 600,
    fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px',
    borderBottom: `1px solid ${C.border}`,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Фильтр месяца */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 14px', color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Всё время</option>
          {months.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span style={{ color: C.sub, fontSize: 13 }}>{byMonth.length} операций</span>
      </div>

      {/* KPI */}
      <div className="grid-4">
        <KPI color={C.green}  icon="💵" label="Доходы"  value={money(income)}
          sub={prevKey ? <KpiDelta cur={income}  prev={prevIncome}  inverse /> : undefined} />
        <KPI color={C.red}    icon="🛒" label="Расходы" value={money(expense)}
          sub={prevKey ? <KpiDelta cur={expense} prev={prevExpense} /> : undefined} />
        <KPI color={balance >= 0 ? C.blue : C.red} icon="📊" label="Баланс"
          value={money(balance)} sub={balance >= 0 ? 'профицит' : 'дефицит'} />
        <KPI color={saveRate >= 0 ? C.green : C.red} icon="🏦" label="Норма сбережений"
          value={`${saveRate.toFixed(1)}%`}
          sub={savedToGoals > 0 ? `${money(savedToGoals)} в накопления` : 'ничего не отложено'} />
        <KPI color={C.yellow} icon="🔒" label="Постоянные траты"
          value={money(fixedBurn)}
          sub="регулярные + долги, в месяц" />
        <KPI color="#fb923c" icon="🎲" label="Переменные траты"
          value={money(variableBurn)}
          sub={variableBurnSub} />
      </div>

      {/* Donut + таблица категорий */}
      {cats.length > 0 ? (
        <div style={{ ...card, display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Donut + легенда */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <Donut segs={cats} center={money(expense)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {cats.slice(0, 7).map(cat => (
                <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                  <span style={{ color: C.sub }}>{cat.name}</span>
                  <span style={{ color: C.text, fontWeight: 600, marginLeft: 'auto', paddingLeft: 12 }}>{cat.pct.toFixed(0)}%</span>
                </div>
              ))}
              {cats.length > 7 && <div style={{ fontSize: 11, color: C.sub }}>+{cats.length - 7} категорий</div>}
            </div>
          </div>

          {/* Таблица */}
          <div style={{ flex: 1, minWidth: 220, overflowX: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>Расходы по категориям</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ ...thS, textAlign: 'left' }}>Категория</th>
                  <th style={thS}>Сумма</th>
                  <th style={thS}>%</th>
                  <th style={thS}>Раз</th>
                  <th style={thS}>Средний чек</th>
                  {prevKey && <th style={thS}>vs пред. мес.</th>}
                </tr>
              </thead>
              <tbody>
                {cats.map((cat, i) => {
                  const isLast = i === cats.length - 1;
                  const border = isLast ? 'none' : `1px solid ${C.border}`;
                  const prev   = prevKey ? (prevCatMap.get(cat.name) ?? 0) : 0;
                  return (
                    <tr key={cat.name}>
                      <td style={{ padding: '10px 8px', borderBottom: border }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: cat.color, flexShrink: 0 }} />
                          <span style={{ color: C.text }}>{cat.name}</span>
                        </div>
                        <div style={{ height: 3, background: C.surface2, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: cat.color, width: `${cat.pct}%`, borderRadius: 2, transition: 'width .4s ease' }} />
                        </div>
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: cat.color, whiteSpace: 'nowrap', borderBottom: border }}>
                        {money(cat.amount)}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.sub, borderBottom: border }}>{cat.pct.toFixed(1)}%</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.sub, borderBottom: border }}>{cat.count}×</td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', color: C.sub, borderBottom: border }}>{money(cat.amount / cat.count)}</td>
                      {prevKey && (
                        <td style={{ padding: '10px 8px', textAlign: 'right', borderBottom: border }}>
                          <Delta cur={cat.amount} prev={prev} />
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ ...card, color: C.sub, textAlign: 'center', padding: 40 }}>
          Нет расходов за выбранный период
        </div>
      )}

      {/* Тренд последних месяцев */}
      {last6.length > 1 && (
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 20 }}>
            📈 Тренд за {last6.length} месяца
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', height: 130 }}>
            {last6.map(([key, label]) => {
              const me = entries.filter(e => parseDateKey(e.date)?.key === key);
              const inc = me.filter(e => e.type === 'Доход').reduce((s, e) => s + n(e.amount), 0);
              const exp = me.filter(e => e.type === 'Расход').reduce((s, e) => s + n(e.amount), 0);
              const incH = Math.round((inc / maxBar) * 108);
              const expH = Math.round((exp / maxBar) * 108);
              const shortL = label.split(' ')[0];
              return (
                <div key={key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
                  <div style={{ width: '100%', display: 'flex', gap: 3, alignItems: 'flex-end', height: 108 }}>
                    <div title={`Доходы: ${money(inc)}`}  style={{ flex: 1, background: C.green, borderRadius: '3px 3px 0 0', height: incH > 0 ? incH : 0 }} />
                    <div title={`Расходы: ${money(exp)}`} style={{ flex: 1, background: C.red,   borderRadius: '3px 3px 0 0', height: expH > 0 ? expH : 0 }} />
                  </div>
                  <div style={{ fontSize: 10, color: C.sub, textAlign: 'center' }}>{shortL}</div>
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.sub }}>
              <div style={{ width: 10, height: 10, background: C.green, borderRadius: 2 }} /> Доходы
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.sub }}>
              <div style={{ width: 10, height: 10, background: C.red, borderRadius: 2 }} /> Расходы
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
