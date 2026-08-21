'use client';

export type Section = 'dashboard' | 'add' | 'journal' | 'shifts' | 'finance' | 'planning';

const tabs = [
  { id: 'dashboard' as Section, emoji: '🏠', text: 'Дашборд' },
  { id: 'journal'   as Section, emoji: '📋', text: 'Журнал' },
  { id: 'shifts'    as Section, emoji: '📅', text: 'Смены' },
  { id: 'finance'   as Section, emoji: '📊', text: 'Финансы' },
  { id: 'planning'  as Section, emoji: '🎯', text: 'Планирование' },
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
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => onChange(tab.id)} style={{
            padding: '7px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 13,
            border: 'none', transition: '.2s', whiteSpace: 'nowrap', flexShrink: 0,
            background: active === tab.id ? 'var(--accent)' : 'transparent',
            color: active === tab.id ? '#fff' : 'var(--sub)',
          }}>
            {tab.emoji} <span className="nav-label">{tab.text}</span>
          </button>
        ))}
      </div>
      {/* Кнопка добавления — действие, не вкладка */}
      <button
        onClick={() => onChange('add')}
        title="Записать операцию"
        style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
          background: active === 'add' ? 'var(--accent2)' : 'var(--accent)',
          border: 'none', cursor: 'pointer', fontSize: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: '.2s', color: '#fff',
        }}
      >➕</button>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', background: 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, flexShrink: 0,
      }}>Е</div>
    </nav>
  );
}
