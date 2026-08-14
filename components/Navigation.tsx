'use client';

export type Section = 'dashboard' | 'add' | 'shifts' | 'salary' | 'debts';

const items = [
  { id: 'dashboard' as Section, label: '🏠 Дашборд' },
  { id: 'add'       as Section, label: '➕ Записать' },
  { id: 'shifts'    as Section, label: '📅 Смены' },
  { id: 'salary'    as Section, label: '📊 Зарплата' },
  { id: 'debts'     as Section, label: '💳 Долги' },
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
            {item.label}
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
