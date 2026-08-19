'use client';

export type Section = 'dashboard' | 'add' | 'journal' | 'shifts' | 'salary' | 'debts' | 'goals';

const items = [
  { id: 'dashboard' as Section, emoji: '🏠', text: 'Дашборд' },
  { id: 'add'       as Section, emoji: '➕', text: 'Записать' },
  { id: 'journal'   as Section, emoji: '📋', text: 'Журнал' },
  { id: 'shifts'    as Section, emoji: '📅', text: 'Смены' },
  { id: 'salary'    as Section, emoji: '📊', text: 'Зарплата' },
  { id: 'debts'     as Section, emoji: '💳', text: 'Долги' },
  { id: 'goals'     as Section, emoji: '🎯', text: 'Цели' },
];

interface Props { active: Section; onChange: (s: Section) => void; }

export default function Navigation({ active, onChange }: Props) {
  return (
    <nav style={{
      background: 'var(--surface)', borderBottom: '1px solid var(--border)',
      padding: '0 12px', height: 60, display: 'flex', alignItems: 'center',
      gap: 8, position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
        💰 ФИНКАБ
      </div>
      <div className="nav-scroll" style={{ flex: 1 }}>
        {items.map(item => (
          <button key={item.id} onClick={() => onChange(item.id)} style={{
            padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            border: 'none', transition: '.2s', whiteSpace: 'nowrap', flexShrink: 0,
            background: active === item.id ? 'var(--accent)' : 'transparent',
            color: active === item.id ? '#fff' : 'var(--sub)',
          }}>
            {item.emoji} <span className="nav-label">{item.text}</span>
          </button>
        ))}
      </div>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}>Е</div>
    </nav>
  );
}
