'use client';

import { useEffect, useState } from 'react';

interface Point { month: string; balance: number; }

const C = { green: '#4ade80', blue: '#6c8ef7', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0' };

function fmt(v: number) { return v.toLocaleString('ru-RU') + ' ₽'; }

function LineChart({ data }: { data: Point[] }) {
  if (data.length < 2) return (
    <div style={{ textAlign: 'center', padding: 40, color: C.sub, fontSize: 13 }}>
      Нужно минимум 2 месяца данных. Снимок сохраняется автоматически 1-го числа каждого месяца.<br />
      <span style={{ fontSize: 12, marginTop: 8, display: 'block' }}>
        Чтобы добавить прошлые данные — внеси их вручную в лист «📈 История» (колонки A: MM.YYYY, B: сумма).
      </span>
    </div>
  );

  const W = 600, H = 220, PL = 70, PR = 20, PT = 20, PB = 40;
  const iW = W - PL - PR, iH = H - PT - PB;

  const values = data.map(d => d.balance);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;

  const px = (i: number) => PL + (i / (data.length - 1)) * iW;
  const py = (v: number) => PT + iH - ((v - minV) / range) * iH;

  const pathD = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(d.balance)}`).join(' ');
  const areaD = `${pathD} L ${px(data.length - 1)} ${PT + iH} L ${px(0)} ${PT + iH} Z`;

  // Y-axis labels (3 values)
  const yLabels = [minV, minV + range / 2, maxV];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid lines */}
      {yLabels.map((v, i) => (
        <g key={i}>
          <line x1={PL} y1={py(v)} x2={W - PR} y2={py(v)} stroke={C.border} strokeDasharray="4 4" />
          <text x={PL - 8} y={py(v) + 4} textAnchor="end" fill={C.sub} fontSize={10}>
            {(v / 1000).toFixed(0)}к
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaD} fill={C.blue} opacity={0.08} />

      {/* Line */}
      <path d={pathD} fill="none" stroke={C.blue} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots + X labels */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={px(i)} cy={py(d.balance)} r={4} fill={C.blue} stroke={C.surface} strokeWidth={2} />
          {/* Show every label if ≤8 points, else every 2nd */}
          {(data.length <= 8 || i % 2 === 0) && (
            <text x={px(i)} y={H - 8} textAnchor="middle" fill={C.sub} fontSize={10}>{d.month.slice(0, 5)}</text>
          )}
        </g>
      ))}

      {/* Last value label */}
      <text x={px(data.length - 1)} y={py(data[data.length - 1].balance) - 10}
        textAnchor="middle" fill={C.green} fontSize={11} fontWeight="bold">
        {fmt(data[data.length - 1].balance)}
      </text>
    </svg>
  );
}

export default function BalanceHistory() {
  const [history, setHistory] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/balance-history')
      .then(r => r.json())
      .then(d => { setHistory(d.history ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: C.sub, padding: 60, textAlign: 'center' }}>Загрузка…</div>;

  const trend = history.length >= 2
    ? history[history.length - 1].balance - history[0].balance
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* KPI */}
      {history.length > 0 && (
        <div className="grid-3">
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.blue }} />
            <div style={{ fontSize: 20, marginBottom: 8 }}>📅</div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Точек данных</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.blue }}>{history.length} мес.</div>
          </div>
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: C.green }} />
            <div style={{ fontSize: 20, marginBottom: 8 }}>💵</div>
            <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>Текущий баланс</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: C.green }}>{fmt(history[history.length - 1].balance)}</div>
          </div>
          {trend !== null && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: trend >= 0 ? C.green : '#f87171' }} />
              <div style={{ fontSize: 20, marginBottom: 8 }}>{trend >= 0 ? '📈' : '📉'}</div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.5px' }}>За весь период</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: trend >= 0 ? C.green : '#f87171' }}>
                {trend >= 0 ? '+' : ''}{fmt(trend)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* График */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 20 }}>
          📈 Динамика баланса по месяцам
        </div>
        <LineChart data={history} />
      </div>
    </div>
  );
}
