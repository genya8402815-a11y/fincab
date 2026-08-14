'use client';

import { useEffect, useState } from 'react';

interface Shift { date: string; phones: string; accessories: string; tech: string; services: string; salary: string; }

const C = { green: '#4ade80', blue: '#6c8ef7', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0' };
const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function n(v: string) { return parseFloat(String(v||'0').replace(/\s/g,'').replace(',','.')) || 0; }
function money(v: string) { const x = n(v); return x > 0 ? x.toLocaleString('ru-RU') + ' ₽' : '—'; }

// DD.MM.YYYY → {month: "MM.YYYY", label: "Июн 2026"}
function parseDateKey(date: string) {
  const parts = date.split('.');
  if (parts.length < 3) return null;
  const m = parseInt(parts[1]) - 1;
  const y = parts[2];
  return { key: `${parts[1]}.${y}`, label: `${RU_MONTHS[m]} ${y}` };
}

function KPI({ color, icon, label, value }: { color: string; icon: string; label: string; value: string|number }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color }} />
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

export default function Shifts() {
  const [shifts,  setShifts]  = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [selMonth, setSelMonth] = useState<string>(''); // "" = все время

  useEffect(() => {
    fetch('/api/shifts').then(r => r.json())
      .then(d => {
        const data: Shift[] = d.shifts ?? [];
        setShifts(data);
        // по умолчанию — текущий месяц
        const now = new Date();
        const curKey = `${String(now.getMonth() + 1).padStart(2,'0')}.${now.getFullYear()}`;
        const hasCurrentMonth = data.some(s => parseDateKey(s.date)?.key === curKey);
        setSelMonth(hasCurrentMonth ? curKey : '');
        setLoading(false);
      })
      .catch(() => { setError('Ошибка загрузки'); setLoading(false); });
  }, []);

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;
  if (error)   return <div style={{ color: '#f87171', padding: 24 }}>{error}</div>;

  // уникальные месяцы из данных
  const months = Array.from(
    new Map(shifts.map(s => { const p = parseDateKey(s.date); return p ? [p.key, p.label] : null; }).filter(Boolean) as [string,string][])
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const filtered = selMonth ? shifts.filter(s => parseDateKey(s.date)?.key === selMonth) : shifts;
  const totalSal = filtered.reduce((s, r) => s + n(r.salary), 0);

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const th = (right?: boolean): React.CSSProperties => ({ textAlign: right ? 'right' : 'left', padding: '8px 12px', color: C.sub, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${C.border}` });
  const td = (right?: boolean): React.CSSProperties => ({ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, textAlign: right ? 'right' : 'left' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <KPI color={C.green} icon="📅" label="Отработано смен" value={filtered.length} />
        <KPI color={C.blue}  icon="💵" label="Итого ЗП"        value={totalSal.toLocaleString('ru-RU') + ' ₽'} />
      </div>

      <div style={card}>
        <div style={cardTitle}>
          <span>📅 Журнал смен</span>
          <select
            value={selMonth}
            onChange={e => setSelMonth(e.target.value)}
            style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
          >
            <option value="">Всё время</option>
            {months.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={th()}>Дата</th>
              <th style={th()}>Телефоны</th>
              <th style={th(true)}>Аксессуары</th>
              <th style={th(true)}>Техника</th>
              <th style={th(true)}>Услуги</th>
              <th style={th(true)}>ЗП за смену</th>
            </tr>
          </thead>
          <tbody>
            {[...filtered].reverse().map((s, i) => (
              <tr key={i}>
                <td style={td()}>{s.date}</td>
                <td style={td()}>{s.phones || '—'}</td>
                <td style={td(true)}>{money(s.accessories)}</td>
                <td style={td(true)}>{money(s.tech)}</td>
                <td style={td(true)}>{money(s.services)}</td>
                <td style={{ ...td(true), color: C.green, fontWeight: 600 }}>{money(s.salary)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: C.sub }}>Нет данных за этот период</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
