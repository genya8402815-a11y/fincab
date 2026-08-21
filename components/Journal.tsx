'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface Entry {
  rowIndex: number;
  date: string;
  type: string;
  amount: string;
  category: string;
  target: string;
  description: string;
}

interface EditForm {
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

const TYPES = ['Расход', 'Доход', 'В накопления', 'Из накоплений', 'Платёж по долгу'];

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
  const [entries,     setEntries]     = useState<Entry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [selMonth,    setSelMonth]    = useState('');
  const [search,      setSearch]      = useState('');
  const [editEntry,   setEditEntry]   = useState<{ rowIndex: number; form: EditForm } | null>(null);
  const [deletingRow, setDeletingRow] = useState<number | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const initialized = useRef(false);

  // Динамические данные для редактирования
  const [cats,  setCats]  = useState<Record<string, string[]>>({});
  const [goals, setGoals] = useState<string[]>([]);
  const [debts, setDebts] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then((d: Record<string, string[]>) => setCats(d)).catch(() => {});
    fetch('/api/goals').then(r => r.json()).then((d: { goals: { name: string }[] }) =>
      setGoals((d.goals ?? []).map(g => g.name).filter(Boolean))
    ).catch(() => {});
    fetch('/api/debts').then(r => r.json()).then((d: { debts: { name: string }[] }) =>
      setDebts((d.debts ?? []).map(db => db.name).filter(Boolean))
    ).catch(() => {});
  }, []);

  const fetchEntries = useCallback(async (): Promise<Entry[]> => {
    const res = await fetch('/api/journal');
    const d = await res.json();
    return (d.entries ?? []) as Entry[];
  }, []);

  // Первичная загрузка
  useEffect(() => {
    fetchEntries()
      .then(data => {
        setEntries(data);
        if (!initialized.current) {
          const now = new Date();
          const curKey = `${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
          const hasCur = data.some(e => parseDateKey(e.date)?.key === curKey);
          setSelMonth(hasCur ? curKey : '');
          initialized.current = true;
        }
        setLoading(false);
      })
      .catch(() => { setError('Ошибка загрузки'); setLoading(false); });
  }, [fetchEntries]);

  // Тихое обновление после edit/delete (без спиннера)
  const refresh = useCallback(async () => {
    try { setEntries(await fetchEntries()); } catch { /* silent */ }
  }, [fetchEntries]);

  const handleEdit = (e: Entry) => {
    setSaveError('');
    setEditEntry({
      rowIndex: e.rowIndex,
      form: { date: e.date, type: e.type, amount: e.amount, category: e.category, target: e.target, description: e.description },
    });
  };

  const handleSave = async () => {
    if (!editEntry) return;
    setSaving(true);
    setSaveError('');
    try {
      const res = await fetch(`/api/journal/${editEntry.rowIndex}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editEntry.form),
      });
      if (!res.ok) throw new Error('Ошибка сервера');
      setEditEntry(null);
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rowIndex: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/journal/${rowIndex}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setDeletingRow(null);
      await refresh();
    } catch {
      setDeletingRow(null);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ color: C.red, padding: 24 }}>{error}</div>;

  const months = Array.from(
    new Map(
      entries.map(e => { const p = parseDateKey(e.date); return p ? [p.key, p.label] : null; })
        .filter(Boolean) as [string, string][]
    )
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const byMonth  = selMonth ? entries.filter(e => parseDateKey(e.date)?.key === selMonth) : entries;
  const filtered = search
    ? byMonth.filter(e =>
        [e.type, e.category, e.description, e.target]
          .some(f => f.toLowerCase().includes(search.toLowerCase()))
      )
    : byMonth;
  const displayed = [...filtered].reverse();

  const income  = byMonth.filter(e => e.type === 'Доход').reduce((s, e) => s + n(e.amount), 0);
  const expense = byMonth.filter(e => e.type === 'Расход').reduce((s, e) => s + n(e.amount), 0);
  const savings = byMonth.filter(e => e.type === 'В накопления').reduce((s, e) => s + n(e.amount), 0);
  const debt    = byMonth.filter(e => e.type === 'Платёж по долгу').reduce((s, e) => s + n(e.amount), 0);

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
  const inputSt: React.CSSProperties = {
    background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8,
    padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none',
    width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      <div className="grid-4">
        <KPI color={C.green}  icon="💵" label="Доходы"     value={money(income)} />
        <KPI color={C.red}    icon="🛒" label="Расходы"    value={money(expense)} />
        <KPI color={C.blue}   icon="🏦" label="Накопления" value={money(savings)} />
        <KPI color={C.purple} icon="💳" label="По долгам"  value={money(debt)} />
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
        <span style={{ color: C.sub, fontSize: 13, whiteSpace: 'nowrap' }}>{displayed.length} записей</span>
      </div>

      {/* Таблица */}
      <div style={card}>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 600 }}>
            <thead>
              <tr>
                <th style={th()}>Дата</th>
                <th style={th()}>Тип</th>
                <th style={th(true)}>Сумма</th>
                <th style={th()}>Категория</th>
                <th style={th()}>Описание</th>
                <th style={{ ...th(), width: 72 }}></th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: C.sub }}>Нет записей</td></tr>
              )}
              {displayed.map((e, i) => {
                const color   = TYPE_COLOR[e.type] || C.sub;
                const sign    = TYPE_SIGN[e.type]  || '';
                const isLast  = i === displayed.length - 1;
                const isDel   = deletingRow === e.rowIndex;
                const tdS = (right?: boolean) => ({
                  ...td(right),
                  ...(isLast ? { borderBottom: 'none' } : {}),
                  ...(isDel  ? { background: '#7f1d1d18' } : {}),
                });
                return (
                  <tr key={e.rowIndex}>
                    <td style={{ ...tdS(), color: C.sub, whiteSpace: 'nowrap' }}>{e.date}</td>
                    <td style={tdS()}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, color, background: `${color}18`, whiteSpace: 'nowrap' }}>
                        {sign} {e.type}
                      </span>
                    </td>
                    <td style={{ ...tdS(true), fontWeight: 700, color, whiteSpace: 'nowrap' }}>{money(n(e.amount))}</td>
                    <td style={{ ...tdS(), color: C.sub }}>{e.category || '—'}</td>
                    <td style={tdS()}>{e.description || e.target || '—'}</td>
                    <td style={{ ...tdS(), padding: '4px 8px', whiteSpace: 'nowrap' }}>
                      {isDel ? (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <button
                            onClick={() => handleDelete(e.rowIndex)}
                            disabled={saving}
                            style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: C.red, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: saving ? .6 : 1 }}
                          >Да</button>
                          <button
                            onClick={() => setDeletingRow(null)}
                            style={{ padding: '3px 8px', borderRadius: 6, border: 'none', background: C.surface2, color: C.sub, fontSize: 11, cursor: 'pointer' }}
                          >Нет</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => handleEdit(e)}
                            title="Редактировать"
                            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: C.surface2, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >✏️</button>
                          <button
                            onClick={() => setDeletingRow(e.rowIndex)}
                            title="Удалить"
                            style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: C.surface2, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          >🗑️</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модалка редактирования */}
      {editEntry && (
        <div
          onClick={() => !saving && setEditEntry(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={ev => ev.stopPropagation()}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {/* Заголовок */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: C.text }}>Редактировать запись</span>
              <button
                onClick={() => !saving && setEditEntry(null)}
                style={{ border: 'none', background: 'none', color: C.sub, fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}
              >×</button>
            </div>

            {/* Дата */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Дата (ДД.ММ.ГГГГ)</label>
              <input
                value={editEntry.form.date}
                onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, date: ev.target.value } })}
                style={inputSt}
              />
            </div>

            {/* Тип */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Тип</label>
              <select
                value={editEntry.form.type}
                onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, type: ev.target.value } })}
                style={inputSt}
              >
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Сумма */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Сумма (₽)</label>
              <input
                type="number"
                value={editEntry.form.amount}
                onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, amount: ev.target.value } })}
                style={inputSt}
              />
            </div>

            {/* Категория */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Категория</label>
              {(() => {
                const t = editEntry.form.type;
                const catKey = t === 'Доход' ? 'income' : t.includes('накопления') ? 'savings' : t.includes('долгу') ? 'debt' : 'expense';
                const list = cats[catKey] ?? [];
                return list.length > 0 ? (
                  <select
                    value={editEntry.form.category}
                    onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, category: ev.target.value } })}
                    style={inputSt}
                  >
                    {list.map(c => <option key={c}>{c}</option>)}
                  </select>
                ) : (
                  <input
                    value={editEntry.form.category}
                    onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, category: ev.target.value } })}
                    style={inputSt}
                  />
                );
              })()}
            </div>

            {/* Цель / Долг */}
            {(() => {
              const t = editEntry.form.type;
              const isSavings = t.includes('накопления');
              const isDebt    = t.includes('долгу');
              if (!isSavings && !isDebt) return null;
              const label = isSavings ? '🎯 Цель накоплений' : '💳 Какой долг?';
              const list  = isSavings ? goals : debts;
              return (
                <div>
                  <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>{label}</label>
                  {list.length > 0 ? (
                    <select
                      value={editEntry.form.target}
                      onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, target: ev.target.value } })}
                      style={inputSt}
                    >
                      {list.map(item => <option key={item}>{item}</option>)}
                    </select>
                  ) : (
                    <input
                      value={editEntry.form.target}
                      onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, target: ev.target.value } })}
                      style={inputSt}
                    />
                  )}
                </div>
              );
            })()}

            {/* Описание */}
            <div>
              <label style={{ fontSize: 12, color: C.sub, display: 'block', marginBottom: 6 }}>Описание</label>
              <input
                value={editEntry.form.description}
                onChange={ev => setEditEntry(p => p && { ...p, form: { ...p.form, description: ev.target.value } })}
                style={inputSt}
              />
            </div>

            {saveError && <div style={{ color: C.red, fontSize: 13 }}>⚠️ {saveError}</div>}

            {/* Кнопки */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: 'none', background: C.green, color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: saving ? .6 : 1 }}
              >{saving ? 'Сохранение…' : 'Сохранить'}</button>
              <button
                onClick={() => !saving && setEditEntry(null)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${C.border}`, background: 'transparent', color: C.sub, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
