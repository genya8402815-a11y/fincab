'use client';

import { useEffect, useState } from 'react';

interface Entry {
  date: string;
  type: string;
  amount: string;
  category: string;
  target: string;
  description: string;
}

const C = {
  green: '#4ade80', red: '#f87171', blue: '#6c8ef7', yellow: '#fbbf24',
  purple: '#c084fc', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27',
  surface2: '#222535', text: '#e2e8f0',
};

const TYPE_COLOR: Record<string, string> = {
  'Расход':           C.red,
  'Доход':            C.green,
  'В накопления':     C.blue,
  'Из накоплений':    C.yellow,
  'Платёж по долгу':  C.purple,
};

const TYPE_SIGN: Record<string, string> = {
  'Расход':           '−',
  'Доход':            '+',
  'В накопления':     '→',
  'Из накоплений':    '←',
  'Платёж по долгу':  '↓',
};

const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function parseDateKey(date: string) {
  const parts = date.split('.');
  if (parts.length < 3) return null;
  const m = parseInt(parts[1]) - 1;
  const y = parts[2];
  return { key: `${parts[1]}.${y}`, label: `${RU_MONTHS[m]} ${y}` };
}

function n(v: string) { return parseFloat(String(v || '0').replace(/\s/g, '').replace(',', '.')) || 0; }
function money(v: number) { return Math.abs(v).toLocaleString('ru-RU') + ' ₽'; }

function KPI({ color, icon, label, value }: { color: string; icon: string; label: string; value: string }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function Journal() {
  const [entries,  setEntries]  = useState<Entry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [selMonth, setSelMonth] = useState('');
  const [search,   setSearch]   = useState('');

  useEffect(() => {
    fetch('/api/journal').then(r => r.json())
      .then(d => {
        const data: Entry[] = d.entries ?? [];
        setEntries(data);
        const now = new Date();
        const curKey = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
        const hasCur = data.some(e => parseDateKey(e.date)?.key === curKey);
        setSelMonth(hasCur ? curKey : '');
        setLoading(false);
      })
      .catch(() => { setError('Ошибка загрузки'); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ color: C.red, padding: 24 }}>{error}</div>;

  const months = Array.from(
    new Map(
      entries.map(e => { const p = parseDateKey(e.date); return p ? [p.key, p.label] : null; })
        .filter(Boolean) as [string, string][]
    )
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const byMonth = selMonth ? entries.filter(e => parseDateKey(e.date)?.key === selMonth) : entries;
  const filtered = search
    ? byMonth.filter(e =>
        e.type.toLowerCase().includes(search.toLowerCase()) ||
        e.category.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        e.target.toLowerCase().includes(search.toLowerCase())
      )
    : byMonth;

  const displayed = [...filtered].reverse();

  const income   = byMonth.filter(e => e.type === 'Доход').reduce((s, e) => s + n(e.amount), 0);
  const expense  = byMonth.filter(e => e.type === 'Расход').reduce((s, e) => s + n(e.amount), 0);
  const savings  = byMonth.filter(e => e.type === 'В накопления').reduce((s, e) => s + n(e.amount), 0);
  const debt     = byMonth.filter(e => e.type === 'Платёж по долгу').reduce((s, e) => s + n(e.amount), 0);

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const th = (right?: boolean) => ({
    textAlign: right ? 'right' as const : 'left' as const,
    padding: '8px 12px', color: C.sub, fontWeight: 600, fontSize: 12,
    textTransform: 'uppercase' as const, letterSpacing: '.5px', borderBottom: `1px solid ${C.border}`,
  });
  const td = (right?: boolean) => ({
    padding: '10px 12px', borderBottom: `1px solid ${C.border}`,
    textAlign: right ? 'right' as const : 'left' as const, verticalAlign: 'middle' as const,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div className="grid-4">
        <KPI color={C.green}  icon="💵" label="Доходы"    value={money(income)} />
        <KPI color={C.red}    icon="🛒" label="Расходы"   value={money(expense)} />
        <KPI color={C.blue}   icon="🏦" label="Накопления" value={money(savings)} />
        <KPI color={C.purple} icon="💳" label="По долгам" value={money(debt)} />
      </div>

      {/* Фильтры */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={selMonth}
          onChange={e => setSelMonth(e.target.value)}
          style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Всё время</option>
          {months.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>

        <input
          type="text"
          placeholder="Поиск по типу, категории, описанию…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none' }}
        />

        <span style={{ color: C.sub, fontSize: 13, whiteSpace: 'nowrap' }}>
          {displayed.length} записей
        </span>
      </div>

      {/* Таблица */}
      <div style={card}>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th()}>Дата</th>
                <th style={th()}>Тип</th>
                <th style={th(true)}>Сумма</th>
                <th style={th()}>Категория</th>
                <th style={th()}>Описание</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: C.sub }}>Нет записей</td></tr>
              )}
              {displayed.map((e, i) => {
                const color = TYPE_COLOR[e.type] || C.sub;
                const sign  = TYPE_SIGN[e.type]  || '';
                const isLast = i === displayed.length - 1;
                const tdS = (right?: boolean) => ({ ...td(right), ...(isLast ? { borderBottom: 'none' } : {}) });
                return (
                  <tr key={i}>
                    <td style={{ ...tdS(), color: C.sub, whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={tdS()}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 6,
                        fontSize: 12, fontWeight: 600, color, background: `${color}18`,
                        whiteSpace: 'nowrap',
                      }}>
                        {sign} {e.type}
                      </span>
                    </td>
                    <td style={{ ...tdS(true), fontWeight: 700, color, whiteSpace: 'nowrap' }}>
                      {money(n(e.amount))}
                    </td>
                    <td style={{ ...tdS(), color: C.sub }}>{e.category || '—'}</td>
                    <td style={tdS()}>{e.description || e.target || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
