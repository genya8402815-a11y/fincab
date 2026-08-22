'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useJournal } from '@/lib/useJournal';

const C = {
  green: '#4ade80', red: '#f87171', yellow: '#fbbf24', blue: '#6c8ef7',
  orange: '#fb923c', sub: '#8892a4', border: '#2d3148',
  surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0',
};

const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function parseDateKey(date: string) {
  const p = date.split('.');
  if (p.length < 3) return null;
  return { key: `${p[1]}.${p[2]}`, label: `${RU_MONTHS[parseInt(p[1]) - 1]} ${p[2]}` };
}

function n(v?: string | number) {
  return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.')) || 0;
}
function money(v: number) { return v.toLocaleString('ru-RU') + ' ₽'; }

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

export default function Budget() {
  const { entries, loading: journalLoading } = useJournal();
  const [budgets,       setBudgets]  = useState<Record<string, number>>({});
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [selMonth,      setSelMonth] = useState('');
  const [editing,       setEditing]  = useState<string | null>(null);
  const [editVal,       setEditVal]  = useState('');
  const [saving,        setSaving]   = useState(false);
  const inputRef     = useRef<HTMLInputElement>(null);
  const monthInitRef = useRef(false);

  const loading = journalLoading || budgetLoading;

  // Загружаем только бюджетные лимиты — журнал приходит из кеша через useJournal
  useEffect(() => {
    fetch('/api/budget').then(r => r.json())
      .then(b => { setBudgets(b.budgets ?? {}); setBudgetLoading(false); })
      .catch(() => setBudgetLoading(false));
  }, []);

  // Инициализируем текущий месяц при первом появлении данных журнала
  useEffect(() => {
    if (!journalLoading && !monthInitRef.current && entries.length > 0) {
      monthInitRef.current = true;
      const now = new Date();
      const cur = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
      setSelMonth(entries.some(e => parseDateKey(e.date)?.key === cur) ? cur : '');
    }
  }, [journalLoading, entries]);

  // Когда начинаем редактировать — фокус на инпут
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const saveBudget = useCallback(async (category: string, amount: number) => {
    setSaving(true);
    try {
      await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, amount }),
      });
      setBudgets(prev => amount > 0 ? { ...prev, [category]: amount } : (() => { const n = { ...prev }; delete n[category]; return n; })());
    } catch { /* silent */ }
    setSaving(false);
    setEditing(null);
  }, []);

  const startEdit = (cat: string) => {
    setEditing(cat);
    setEditVal(String(budgets[cat] ?? ''));
  };

  const commitEdit = () => {
    if (!editing) return;
    saveBudget(editing, n(editVal));
  };

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;

  const months = Array.from(
    new Map(entries.map(e => { const p = parseDateKey(e.date); return p ? [p.key, p.label] : null; }).filter(Boolean) as [string, string][])
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const byMonth = selMonth ? entries.filter(e => parseDateKey(e.date)?.key === selMonth) : entries;
  const expenses = byMonth.filter(e => e.type === 'Расход');

  // Группируем расходы по категориям
  const catActual = new Map<string, number>();
  expenses.forEach(e => {
    const cat = e.category || 'Прочее';
    catActual.set(cat, (catActual.get(cat) ?? 0) + n(e.amount));
  });

  // Объединяем: категории из расходов + категории с бюджетом
  const allCats = Array.from(new Set([...catActual.keys(), ...Object.keys(budgets)])).sort();

  // ИСПРАВЛЕНИЕ (22.08.2026): totalActual раньше суммировал ВСЕ расходы, включая
  // категории без заданного лимита, а totalBudget — только категории С лимитом.
  // "Остаток" сравнивал две разные выборки трат, из-за чего мог показывать
  // перерасход/остаток, не соответствующий факту по бюджетируемым категориям.
  // Для "Остатка" теперь считаем факт ТОЛЬКО по категориям с заданным лимитом —
  // честное план vs факт. totalActual (все траты периода) оставляем отдельно —
  // это по-прежнему полезная цифра для карточки "Потрачено".
  const totalActual         = Array.from(catActual.values()).reduce((s, v) => s + v, 0);
  const totalActualBudgeted = Object.keys(budgets).reduce((s, cat) => s + (catActual.get(cat) ?? 0), 0);
  const totalBudget   = Object.values(budgets).reduce((s, v) => s + v, 0);
  const overCount     = allCats.filter(c => budgets[c] && (catActual.get(c) ?? 0) > budgets[c]).length;
  const remaining     = totalBudget - totalActualBudgeted;

  const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Фильтр */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <select
          value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Всё время</option>
          {months.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span style={{ fontSize: 12, color: C.sub }}>Нажми на бюджет категории чтобы изменить</span>
      </div>

      {/* KPI */}
      <div className="grid-4">
        <KPI color={C.blue}   icon="📋" label="Бюджет (план)"    value={totalBudget > 0 ? money(totalBudget) : 'Не задан'} />
        <KPI color={C.red}    icon="🛒" label="Потрачено"         value={money(totalActual)} />
        <KPI color={remaining >= 0 ? C.green : C.red} icon="💰" label="Остаток"
          value={money(Math.abs(remaining))}
          sub={totalBudget > 0 ? (remaining >= 0 ? 'в рамках бюджета' : 'перерасход') : '—'} />
        <KPI color={overCount > 0 ? C.red : C.green} icon={overCount > 0 ? '⚠️' : '✅'} label="Превышено"
          value={overCount > 0 ? `${overCount} кат.` : 'Всё ок'} />
      </div>

      {/* Категории */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 20 }}>
          💡 План vs Факт по категориям
        </div>

        {allCats.length === 0 && (
          <div style={{ color: C.sub, textAlign: 'center', padding: 40 }}>
            Нет расходов за выбранный период
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {allCats.map(cat => {
            const actual  = catActual.get(cat) ?? 0;
            const budget  = budgets[cat] ?? 0;
            const pct     = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0;
            const over    = budget > 0 && actual > budget;
            const barColor = over ? C.red : pct > 80 ? C.yellow : C.green;
            const isEdit  = editing === cat;

            return (
              <div key={cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  {/* Название */}
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{cat}</span>

                  {/* Суммы + редактирование */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ color: over ? C.red : C.text, fontWeight: 700 }}>{money(actual)}</span>
                    <span style={{ color: C.sub }}>/</span>

                    {isEdit ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          ref={inputRef}
                          type="number"
                          value={editVal}
                          onChange={e => setEditVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(null); }}
                          onBlur={commitEdit}
                          placeholder="Лимит ₽"
                          style={{ width: 100, background: C.surface2, border: `1px solid ${C.blue}`, borderRadius: 6, padding: '4px 8px', color: C.text, fontSize: 13, outline: 'none' }}
                        />
                        <span style={{ fontSize: 11, color: C.sub }}>Enter</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(cat)}
                        disabled={saving}
                        title="Задать лимит"
                        style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', color: budget > 0 ? C.sub : C.blue, fontSize: 13, cursor: 'pointer' }}
                      >
                        {budget > 0 ? money(budget) : '+ лимит'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Прогресс бар */}
                <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
                  {budget > 0 ? (
                    <div style={{
                      height: '100%', borderRadius: 4, background: barColor,
                      width: `${pct}%`, transition: 'width .4s ease',
                    }} />
                  ) : (
                    <div style={{ height: '100%', borderRadius: 4, background: C.blue, width: '100%', opacity: .15 }} />
                  )}
                </div>

                {/* Подпись */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, fontSize: 11, color: C.sub }}>
                  <span>
                    {budget > 0
                      ? over
                        ? `⚠️ Перерасход ${money(actual - budget)}`
                        : `Осталось ${money(budget - actual)}`
                      : 'Лимит не задан — нажми чтобы добавить'
                    }
                  </span>
                  {budget > 0 && <span>{pct.toFixed(0)}%</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
