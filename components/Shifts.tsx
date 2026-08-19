'use client';

import { useEffect, useState } from 'react';

interface SalaryData { scheduled: string; worked: string; remaining: string; pace: string[][]; }
interface Shift { date: string; phones: string; accessories: string; tech: string; services: string; salary: string; }

const C = {
  green: '#4ade80', blue: '#6c8ef7', yellow: '#fbbf24', orange: '#fb923c',
  purple: '#c084fc', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27',
  surface2: '#222535', text: '#e2e8f0',
};
const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function n(v?: string) { return parseFloat(String(v ?? '0').replace(/\s/g,'').replace(',','.').replace('₽','')) || 0; }
function money(v: number) { return v > 0 ? v.toLocaleString('ru-RU') + ' ₽' : '—'; }
function moneyS(v: string) { return money(n(v)); }

function parseDateKey(date: string) {
  const parts = date.split('.');
  if (parts.length < 3) return null;
  const m = parseInt(parts[1]) - 1;
  const y = parts[2];
  return { key: `${parts[1]}.${y}`, label: `${RU_MONTHS[m]} ${y}` };
}

function KPI({ color, icon, label, value, sub }: { color: string; icon: string; label: string; value: string | number; sub?: string }) {
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

export default function Shifts() {
  const [sal,     setSal]     = useState<SalaryData | null>(null);
  const [shifts,  setShifts]  = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/salary').then(r => r.json()),
      fetch('/api/shifts').then(r => r.json()),
    ]).then(([s, sh]) => {
      setSal(s);
      const data: Shift[] = sh.shifts ?? [];
      setShifts(data);
      const now = new Date();
      const curKey = `${String(now.getMonth() + 1).padStart(2,'0')}.${now.getFullYear()}`;
      setSelMonth(data.some(s => parseDateKey(s.date)?.key === curKey) ? curKey : '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !sal) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;

  const months = Array.from(
    new Map(shifts.map(s => { const p = parseDateKey(s.date); return p ? [p.key, p.label] : null; }).filter(Boolean) as [string,string][])
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const filtered    = selMonth ? shifts.filter(s => parseDateKey(s.date)?.key === selMonth) : shifts;
  const monthLabel  = selMonth ? (months.find(([k]) => k === selMonth)?.[1] ?? '') : 'всё время';

  const totalSal    = filtered.reduce((s, r) => s + n(r.salary), 0);
  const totalPhones = filtered.reduce((s, r) => s + n(r.phones), 0);
  const totalAcc    = filtered.reduce((s, r) => s + n(r.accessories), 0);
  const totalTech   = filtered.reduce((s, r) => s + n(r.tech), 0);
  const totalSvc    = filtered.reduce((s, r) => s + n(r.services), 0);

  const worked    = n(sal.worked);
  const scheduled = n(sal.scheduled);
  const progress  = scheduled > 0 ? Math.min((worked / scheduled) * 100, 100) : 0;

  const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const th = (right?: boolean): React.CSSProperties => ({
    textAlign: right ? 'right' : 'left', padding: '8px 12px', color: C.sub, fontWeight: 600,
    fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${C.border}`,
  });
  const td = (right?: boolean): React.CSSProperties => ({
    padding: '10px 12px', borderBottom: `1px solid ${C.border}`, textAlign: right ? 'right' : 'left',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Фильтр */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <select
          value={selMonth} onChange={e => setSelMonth(e.target.value)}
          style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
        >
          <option value="">Всё время</option>
          {months.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <span style={{ color: C.sub, fontSize: 13 }}>{filtered.length} смен — {monthLabel}</span>
      </div>

      {/* KPI: смены + ЗП */}
      <div className="grid-4">
        <KPI color={C.green}  icon="✅" label="Отработано"   value={`${filtered.length} смен`} />
        <KPI color={C.blue}   icon="📅" label="По графику"   value={`${sal.scheduled} смен`}   sub={`осталось ${sal.remaining}`} />
        <KPI color={C.green}  icon="💵" label="Итого ЗП"     value={money(totalSal)}            sub={`ср. ${filtered.length > 0 ? money(Math.round(totalSal / filtered.length)) : '—'}/смена`} />
        <KPI color={C.yellow} icon="📱" label="Телефонов"    value={`${totalPhones} шт`} />
      </div>

      {/* KPI: показатели продаж */}
      <div className="grid-3">
        <KPI color={C.yellow} icon="🎧" label="Аксессуары" value={money(totalAcc)} />
        <KPI color={C.blue}   icon="💻" label="Техника ВП" value={money(totalTech)} />
        <KPI color={C.orange} icon="🛠" label="Услуги"     value={money(totalSvc)} />
      </div>

      {/* Прогресс смен + Трекер темпа */}
      <div className="grid-2-1">
        {/* Трекер темпа */}
        {sal.pace?.length > 0 ? (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16 }}>
              📈 Трекер темпа (текущий месяц)
            </div>
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 380 }}>
                <tbody>
                  {sal.pace.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '9px 10px', color: C.sub, fontWeight: 600, borderBottom: `1px solid ${C.border}` }}>{r[0]}</td>
                      <td style={{ padding: '9px 10px', color: C.sub, borderBottom: `1px solid ${C.border}` }}>{r[1]}</td>
                      {r.slice(2, -1).map((cell, j) => (
                        <td key={j} style={{ padding: '9px 10px', borderBottom: `1px solid ${C.border}` }}>{cell}</td>
                      ))}
                      <td style={{ padding: '9px 10px', textAlign: 'right', borderBottom: `1px solid ${C.border}` }}>{r[r.length - 1]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : <div />}

        {/* Прогресс месяца */}
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 20 }}>
            📅 Прогресс месяца
          </div>
          {[
            { label: 'По графику',  value: `${sal.scheduled} смен`, color: C.blue },
            { label: 'Отработано',  value: `${sal.worked} смен`,    color: C.green },
            { label: 'Осталось',    value: `${sal.remaining} смен`, color: C.orange },
          ].map(({ label, value, color }, i, arr) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none', fontSize: 13 }}>
              <span style={{ color: C.sub }}>{label}</span>
              <span style={{ fontWeight: 700, color }}>{value}</span>
            </div>
          ))}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.sub, marginBottom: 8 }}>
              <span>Прогресс</span><span>{progress.toFixed(0)}%</span>
            </div>
            <div style={{ height: 8, background: C.surface2, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 4, background: C.green, width: `${progress}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>Итого ЗП за период</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: C.green }}>{money(totalSal)}</div>
          </div>
        </div>
      </div>

      {/* Журнал смен */}
      <div style={card}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16 }}>
          📋 Журнал смен
        </div>
        <div className="table-scroll">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500 }}>
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
              {[...filtered].reverse().map((s, i, arr) => (
                <tr key={i}>
                  <td style={{ ...td(), ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{s.date}</td>
                  <td style={{ ...td(), ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{s.phones || '—'}</td>
                  <td style={{ ...td(true), ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{moneyS(s.accessories)}</td>
                  <td style={{ ...td(true), ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{moneyS(s.tech)}</td>
                  <td style={{ ...td(true), ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{moneyS(s.services)}</td>
                  <td style={{ ...td(true), color: C.green, fontWeight: 700, ...(i === arr.length - 1 ? { borderBottom: 'none' } : {}) }}>{moneyS(s.salary)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: C.sub }}>Нет данных за этот период</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
