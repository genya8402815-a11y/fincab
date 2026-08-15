'use client';

import { useEffect, useState } from 'react';

interface SalaryData { scheduled: string; worked: string; remaining: string; pace: string[][]; }
interface Shift { date: string; phones: string; accessories: string; tech: string; services: string; salary: string; }

const C = { green: '#4ade80', blue: '#6c8ef7', yellow: '#fbbf24', orange: '#fb923c', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0' };
const RU_MONTHS = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];

function n(v?: string) { return parseFloat(String(v??'0').replace(/\s/g,'').replace(',','.').replace('₽','')) || 0; }
function money(v: number) { return v.toLocaleString('ru-RU') + ' ₽'; }

function parseDateKey(date: string) {
  const parts = date.split('.');
  if (parts.length < 3) return null;
  const m = parseInt(parts[1]) - 1;
  const y = parts[2];
  return { key: `${parts[1]}.${y}`, label: `${RU_MONTHS[m]} ${y}` };
}

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

export default function Salary() {
  const [sal,    setSal]    = useState<SalaryData | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selMonth, setSelMonth] = useState<string>('');

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
      const hasCurrentMonth = data.some(s => parseDateKey(s.date)?.key === curKey);
      setSelMonth(hasCurrentMonth ? curKey : '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading || !sal) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;

  const months = Array.from(
    new Map(shifts.map(s => { const p = parseDateKey(s.date); return p ? [p.key, p.label] : null; }).filter(Boolean) as [string,string][])
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const filtered = selMonth ? shifts.filter(s => parseDateKey(s.date)?.key === selMonth) : shifts;
  const monthLabel = selMonth ? (months.find(([k]) => k === selMonth)?.[1] ?? '') : 'всё время';

  const totalPhones = filtered.reduce((s, r) => s + n(r.phones), 0);
  const totalAcc    = filtered.reduce((s, r) => s + n(r.accessories), 0);
  const totalTech   = filtered.reduce((s, r) => s + n(r.tech), 0);
  const totalSvc    = filtered.reduce((s, r) => s + n(r.services), 0);
  const totalSal    = filtered.reduce((s, r) => s + n(r.salary), 0);

  const worked    = n(sal.worked);
  const scheduled = n(sal.scheduled);
  const progress  = scheduled > 0 ? Math.min((worked / scheduled) * 100, 100) : 0;

  const card = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
  const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const row = (last?: boolean): React.CSSProperties => ({ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : `1px solid ${C.border}`, fontSize: 13 });
  const th: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', color: C.sub, fontWeight: 600, fontSize: 12, textTransform: 'uppercase', letterSpacing: '.5px', borderBottom: `1px solid ${C.border}` };
  const td: React.CSSProperties = { padding: '10px 12px', borderBottom: `1px solid ${C.border}` };

  const filterSelect = (
    <select
      value={selMonth}
      onChange={e => setSelMonth(e.target.value)}
      style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.text, fontSize: 13, outline: 'none', cursor: 'pointer' }}
    >
      <option value="">Всё время</option>
      {months.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
    </select>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Фильтр */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: C.sub, fontSize: 14 }}>Период:</span>
        {filterSelect}
        <span style={{ color: C.sub, fontSize: 13 }}>— {monthLabel}, {filtered.length} смен</span>
      </div>

      <div className="grid-4">
        <KPI color={C.blue}   icon="📱" label="Телефоны"   value={`${totalPhones} шт`} sub={`за ${filtered.length} смен`} />
        <KPI color={C.yellow} icon="🎧" label="Аксессуары" value={money(totalAcc)} />
        <KPI color={C.green}  icon="💻" label="Техника ВП" value={money(totalTech)} />
        <KPI color={C.orange} icon="🛠" label="Услуги"     value={money(totalSvc)} />
      </div>

      <div className="grid-2">
        {/* Смены (из API — всегда текущий месяц) */}
        <div style={card}>
          <div style={cardTitle}>📅 Смены (текущий месяц)</div>
          <div style={row()}>
            <span style={{ color: C.sub }}>По графику</span>
            <span style={{ fontWeight: 600 }}>{sal.scheduled} смен</span>
          </div>
          <div style={row()}>
            <span style={{ color: C.sub }}>Отработано</span>
            <span style={{ fontWeight: 700, color: C.green }}>{sal.worked} смен</span>
          </div>
          <div style={row(true)}>
            <span style={{ color: C.sub }}>Осталось</span>
            <span style={{ fontWeight: 600, color: C.orange }}>{sal.remaining} смен</span>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: C.sub, marginBottom: 6 }}>
              <span>Прогресс</span><span>{progress.toFixed(0)}%</span>
            </div>
            <div style={{ height: 6, background: C.surface2, borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', borderRadius: 3, background: C.green, width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {/* ЗП за выбранный период */}
        <div style={card}>
          <div style={cardTitle}>
            <span>📊 Итого зарплата</span>
            <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'none' }}>{monthLabel}</span>
          </div>
          <div style={{ color: C.sub, fontSize: 13, marginBottom: 6 }}>Начислено за {filtered.length} смен</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: C.green }}>{money(totalSal)}</div>
          <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12, marginTop: 16 }}>
            <div style={row(true)}>
              <span style={{ color: C.sub }}>Средняя смена</span>
              <span style={{ fontWeight: 600 }}>
                {filtered.length > 0 ? money(Math.round(totalSal / filtered.length)) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Трекер темпа */}
      {sal.pace?.length > 0 && (
        <div style={card}>
          <div style={cardTitle}>📈 Трекер темпа (текущий месяц)</div>
          <div className="table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 420 }}>
            <tbody>
              {sal.pace.map((r, i) => (
                <tr key={i}>
                  <td style={{ ...td, color: C.sub, fontWeight: 600 }}>{r[0]}</td>
                  <td style={{ ...td, color: C.sub }}>{r[1]}</td>
                  {r.slice(2, -1).map((cell, j) => <td key={j} style={td}>{cell}</td>)}
                  <td style={{ ...td, textAlign: 'right' }}>{r[r.length - 1]}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      )}
    </div>
  );
}
