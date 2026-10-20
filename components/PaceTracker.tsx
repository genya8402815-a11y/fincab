'use client';

import React from 'react';

/**
 * Трекер темпа (смены): читаемая версия данных из «📊 Расчёт ЗП»!B89:H101.
 *
 * Вход — `pace`: массив строк таблицы как есть:
 *   [0]  сводка:  «Смен в графике:», N, «Отработано:», N, «Осталось смен:», N
 *   [1]  шапка:   Показатель | Уровень | План | Факт | Осталось | Нужно/смену | Статус
 *   [2…] данные;  колонка «Показатель» заполнена только в первой строке группы.
 *
 * variant="full"    — вкладка «Смены»: сводка, «ближайшая цель», таблица по группам с полосками.
 * variant="compact" — Дашборд: плотный список без шапки и лишних колонок.
 */

const C = {
  green: '#4ade80', red: '#f87171', blue: '#6c8ef7', yellow: '#fbbf24', orange: '#fb923c',
  sub: '#8892a4', border: '#2d3148', surface2: '#222535', text: '#e2e8f0',
  divider: 'rgba(148,163,184,0.22)',   // полупрозрачные вертикальные разделители
};

type Kind = 'done' | 'ok' | 'behind' | 'idle';

interface Row { level: string; plan: string; fact: string; left: string; perShift: string; kind: Kind; statusText: string; pct: number }
interface Group { label: string; icon: string; unit: string; rows: Row[] }

function n(v?: string) { return parseFloat(String(v ?? '0').replace(/[\s ₽]/g, '').replace(',', '.')) || 0; }

function kindOf(s: string): Kind {
  if (s.includes('выполнен')) return 'done';
  if (s.includes('в графике')) return 'ok';
  if (s.includes('отстаёшь')) return 'behind';
  return 'idle';
}
// «🟢 в графике» → «в графике» (эмодзи заменяем собственным индикатором)
function statusLabel(s: string) {
  const parts = s.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : s.trim();
}
function cleanLabel(raw: string) {
  return raw
    .replace(/^Валовая \((.*?)\s*₽\)$/, '$1')      // «Валовая (Техника ₽)» → «Техника»
    .replace(/\s*\((₽|шт\.)\)$/, '')               // «Аксессуары (₽)» → «Аксессуары»
    .trim();
}
function unitFor(raw: string) { return raw.includes('₽') ? ' ₽' : raw.includes('шт') ? ' шт.' : ''; }
function iconFor(raw: string) {
  if (/iphone/i.test(raw)) return '🍏';
  if (/android/i.test(raw)) return '🤖';
  if (/аксесс/i.test(raw)) return '🎧';
  if (/техн|валов/i.test(raw)) return '💻';
  if (/услуг/i.test(raw)) return '🛠';
  return '•';
}
const KIND_COLOR: Record<Kind, string> = { done: C.blue, ok: C.green, behind: C.red, idle: C.yellow };

function parse(pace: string[][]) {
  const summary = pace[0] ?? [];
  const hdr = pace.findIndex(r => (r?.[0] ?? '').trim() === 'Показатель');
  const start = hdr >= 0 ? hdr + 1 : 2;
  const groups: Group[] = [];
  for (const r of pace.slice(start)) {
    if (!r || (r[1] ?? '').trim() === '') continue;
    const head = (r[0] ?? '').trim();
    if (head) groups.push({ label: cleanLabel(head), icon: iconFor(head), unit: unitFor(head), rows: [] });
    const g = groups[groups.length - 1];
    if (!g) continue;
    const status = String(r[6] ?? '');
    const kind = kindOf(status);
    const plan = n(r[2]);
    const fact = n(r[3]);
    const pct = plan > 0 ? Math.min(100, (fact / plan) * 100) : kind === 'done' ? 100 : 0;
    g.rows.push({
      level: String(r[1] ?? ''), plan: String(r[2] ?? ''), fact: String(r[3] ?? ''),
      left: String(r[4] ?? ''), perShift: String(r[5] ?? ''),
      kind, statusText: statusLabel(status), pct,
    });
  }
  return {
    scheduled: n(summary[1]), worked: n(summary[3]), remaining: n(summary[5]),
    groups,
  };
}

function Status({ row }: { row: Row }) {
  const color = KIND_COLOR[row.kind];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
      {row.kind === 'done'
        ? <span style={{ color, fontWeight: 700 }}>✓</span>
        : <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />}
      {row.statusText}
    </span>
  );
}

function Bar({ pct, color, width = 52 }: { pct: number; color: string; width?: number }) {
  return (
    <span style={{ display: 'inline-block', width, height: 6, borderRadius: 3, background: C.border, overflow: 'hidden', verticalAlign: 'middle' }}>
      <span style={{ display: 'block', width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
    </span>
  );
}

export default function PaceTracker({ pace, variant = 'full' }: { pace: string[][]; variant?: 'full' | 'compact' }) {
  const { scheduled, worked, remaining, groups } = parse(pace ?? []);
  if (groups.length === 0) return <span style={{ color: C.sub, fontSize: 13 }}>Нет данных</span>;

  // ── Компактная версия (Дашборд) ──────────────────────────────────────────
  if (variant === 'compact') {
    return (
      <div>
        <div style={{ fontSize: 12, color: C.sub, marginBottom: 10 }}>
          Смен: {worked} из {scheduled} · осталось {remaining}
        </div>
        {groups.flatMap(g => g.rows.map((r, i) => ({ g, r, i }))).map(({ g, r, i }, k, all) => (
          <div key={k} style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', fontSize: 13,
            borderBottom: k === all.length - 1 ? 'none' : `1px solid ${C.border}`,
          }}>
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: i === 0 ? C.text : C.sub }}>
              {i === 0 ? `${g.icon} ${g.label} · ${r.level}` : `  ${r.level}`}
            </span>
            <span style={{ flexShrink: 0 }}><Bar pct={r.pct} color={KIND_COLOR[r.kind]} width={44} /></span>
            <span style={{ width: 170, flexShrink: 0, textAlign: 'right', whiteSpace: 'nowrap', color: C.sub, fontVariantNumeric: 'tabular-nums' }}>
              {r.fact} / {r.plan}
            </span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: KIND_COLOR[r.kind] }} title={r.statusText} />
          </div>
        ))}
      </div>
    );
  }

  // ── Полная версия (вкладка «Смены») ──────────────────────────────────────
  const monthPct = scheduled > 0 ? Math.min(100, Math.round((worked / scheduled) * 100)) : 0;

  // «Ближайшая цель»: среди отстающих — тот уровень, который ближе всего к выполнению
  const behind = groups.flatMap(g => g.rows.map(r => ({ g, r }))).filter(x => x.r.kind === 'behind');
  const nearest = behind.length > 0 ? behind.reduce((a, b) => (b.r.pct > a.r.pct ? b : a)) : null;

  const base: React.CSSProperties = { padding: '9px 12px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };
  const num: React.CSSProperties = { ...base, textAlign: 'right' };
  const th: React.CSSProperties = { ...base, color: C.sub, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' };
  const vline = `1px solid ${C.divider}`;
  const chip: React.CSSProperties = { background: C.surface2, borderRadius: 10, padding: '10px 14px', flex: '1 1 110px' };

  return (
    <div>
      {/* Сводка по сменам */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={chip}><div style={{ fontSize: 11, color: C.sub }}>В графике</div><div style={{ fontSize: 20, fontWeight: 700 }}>{scheduled} <span style={{ fontSize: 12, color: C.sub, fontWeight: 400 }}>смен</span></div></div>
        <div style={chip}><div style={{ fontSize: 11, color: C.sub }}>Отработано</div><div style={{ fontSize: 20, fontWeight: 700, color: C.green }}>{worked} <span style={{ fontSize: 12, color: C.sub, fontWeight: 400 }}>смен</span></div></div>
        <div style={chip}><div style={{ fontSize: 11, color: C.sub }}>Осталось</div><div style={{ fontSize: 20, fontWeight: 700, color: C.orange }}>{remaining} <span style={{ fontSize: 12, color: C.sub, fontWeight: 400 }}>смен</span></div></div>
        <div style={{ ...chip, flex: '1.6 1 180px' }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>Месяц пройден на {monthPct}%</div>
          <div style={{ height: 8, borderRadius: 4, background: C.border, overflow: 'hidden' }}>
            <div style={{ width: `${monthPct}%`, height: '100%', background: C.green, borderRadius: 4 }} />
          </div>
        </div>
      </div>

      {/* Ближайшая цель */}
      <div style={{ background: C.surface2, borderLeft: `3px solid ${nearest ? C.yellow : C.green}`, padding: '10px 14px', marginBottom: 16, fontSize: 13, lineHeight: 1.5 }}>
        {nearest ? (
          <>
            <span style={{ color: C.sub }}>Ближайшая цель:</span> {nearest.g.label} до уровня «{nearest.r.level}» — ещё{' '}
            <b>{nearest.r.left}{nearest.g.unit}</b>, это <b style={{ color: C.yellow }}>{nearest.r.perShift}{nearest.g.unit} в смену</b>. Отстаёшь от темпа.
          </>
        ) : (
          <span style={{ color: C.sub }}>Все показатели идут по графику или выполнены.</span>
        )}
      </div>

      {/* Таблица по группам: всё в одну строку, при нехватке ширины скроллится */}
      <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: 'left' }}>Уровень</th>
              <th style={{ ...th, textAlign: 'right', borderLeft: vline }}>План</th>
              <th style={{ ...th, textAlign: 'right' }}>Факт</th>
              <th style={{ ...th, textAlign: 'right' }}>Осталось</th>
              <th style={{ ...th, textAlign: 'right' }}>Нужно/смену</th>
              <th style={{ ...th, textAlign: 'left' }}>Выполнено</th>
              <th style={{ ...th, textAlign: 'left', borderLeft: vline }}>Статус</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => (
              <React.Fragment key={g.label}>
                <tr>
                  <td colSpan={7} style={{ ...base, background: C.surface2, fontWeight: 600, padding: '8px 12px' }}>
                    {g.icon} {g.label}{g.unit ? <span style={{ color: C.sub, fontWeight: 400 }}>,{g.unit}</span> : null}
                  </td>
                </tr>
                {g.rows.map(r => (
                  <tr key={r.level}>
                    <td style={{ ...base, color: C.sub }}>{r.level}</td>
                    <td style={{ ...num, borderLeft: vline }}>{r.plan}</td>
                    <td style={num}>{r.fact}</td>
                    <td style={num}>{r.left}</td>
                    <td style={num}>{r.perShift}</td>
                    <td style={base}><Bar pct={r.pct} color={KIND_COLOR[r.kind]} /> <span style={{ marginLeft: 8 }}>{Math.round(r.pct)}%</span></td>
                    <td style={{ ...base, borderLeft: vline }}><Status row={r} /></td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
