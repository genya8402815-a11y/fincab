'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Toast from '@/components/Toast';

const C = { blue: '#6c8ef7', green: '#4ade80', red: '#f87171', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0' };

function toRuDate(iso: string) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const TYPES = ['🛒 Расход', '💵 Доход', '🏦 В накопления', '↩️ Из накоплений', '💳 Платёж по долгу'];

type CatType = 'expense' | 'income' | 'debt' | 'savings';
type CatsMap = Record<CatType, string[]>;

const FB: CatsMap = {
  expense:  ['Продукты', 'Транспорт', 'Кафе и рестораны', 'Связь', 'Развлечения', 'Подписки', 'Здоровье', 'Прочее'],
  income:   ['Зарплата', 'Фриланс', 'Подработка', 'Прочее'],
  debt:     ['Кредит', 'Ипотека', 'Долг другу', 'Рассрочка', 'Прочее'],
  savings:  ['Подушка безопасности', 'Отпуск', 'Крупная покупка', 'Инвестиции', 'Прочее'],
};

const MANAGE_TABS: { key: CatType; label: string }[] = [
  { key: 'expense',  label: '🛒 Расходы' },
  { key: 'income',   label: '💵 Доходы' },
  { key: 'debt',     label: '💳 Долги' },
  { key: 'savings',  label: '🏦 Накопления' },
];

function typeToCategory(opType: string): CatType {
  if (opType.includes('Доход'))      return 'income';
  if (opType.includes('накопления')) return 'savings';
  if (opType.includes('долгу'))      return 'debt';
  return 'expense';
}

const card: React.CSSProperties = { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 20 };
const cardTitle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 16 };
const inputS: React.CSSProperties = { background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 14px', color: C.text, fontSize: 14, outline: 'none', width: '100%' };
const labelS: React.CSSProperties = { fontSize: 12, color: C.sub, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6, display: 'block' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={labelS}>{label}</label>{children}</div>;
}

export default function AddRecord() {
  const [toast,    setToast]   = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });
  const [opSaving, setOpSaving] = useState(false);
  const [shSaving, setShSaving] = useState(false);
  const [syncSaving, setSyncSaving] = useState(false);

  const [cats,      setCats]     = useState<CatsMap>(FB);
  const [catsReady, setCatsReady] = useState(false);
  const [manageTab, setManageTab] = useState<CatType>('expense');
  const [showManage, setShowManage] = useState(false);
  const [newCat,    setNewCat]   = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const newCatRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });
  const hideToast = useCallback(() => setToast({ message: '', type: '' }), []);

  const [opDate, setOpDate] = useState(todayIso());
  const [opType, setOpType] = useState(TYPES[0]);
  const [opAmt,  setOpAmt]  = useState('');
  const [opCat,  setOpCat]  = useState(FB.expense[0]);
  const [opDesc, setOpDesc] = useState('');

  const [shDate,  setShDate]  = useState(todayIso());
  const [shPhone, setShPhone] = useState('');
  const [shAcc,   setShAcc]   = useState('');
  const [shTech,  setShTech]  = useState('');
  const [shSvc,   setShSvc]   = useState('');

  const activeCatType = typeToCategory(opType);
  const activeCats    = cats[activeCatType];

  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then((d: CatsMap) => {
      setCats(c => ({ ...c, ...d }));
      setOpCat(d.expense?.[0] ?? FB.expense[0]);
      setCatsReady(true);
    }).catch(() => setCatsReady(true));
  }, []);

  // При смене типа — переключаем на первую категорию нужного типа
  useEffect(() => {
    setOpCat(cats[typeToCategory(opType)]?.[0] ?? '');
  }, [opType]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyCats(d: Partial<CatsMap>) {
    setCats(prev => ({ ...prev, ...d }));
  }

  async function saveOp() {
    setOpSaving(true);
    try {
      const res  = await fetch('/api/add', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'operation', date: toRuDate(opDate), type: opType.replace(/^[^\s]+ /, ''), amount: opAmt, category: opCat, description: opDesc }) });
      const data = await res.json();
      if (data.ok) { showToast('Операция записана!', 'success'); setOpAmt(''); setOpDesc(''); }
      else showToast(data.error ?? 'Ошибка', 'error');
    } catch { showToast('Ошибка сети', 'error'); }
    setOpSaving(false);
  }

  async function saveShift() {
    setShSaving(true);
    try {
      const res  = await fetch('/api/add', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'shift', date: toRuDate(shDate), phones: shPhone, accessories: shAcc, tech: shTech, services: shSvc }) });
      const data = await res.json();
      if (data.ok) { showToast('Смена записана!', 'success'); setShPhone(''); setShAcc(''); setShTech(''); setShSvc(''); }
      else showToast(data.error ?? 'Ошибка', 'error');
    } catch { showToast('Ошибка сети', 'error'); }
    setShSaving(false);
  }

  async function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    setCatSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: manageTab }),
      });
      const d = await res.json();
      if (d.action === 'already_exists') showToast('Такая категория уже есть', 'error');
      else { applyCats(d); showToast(`«${name}» добавлена`, 'success'); }
      setNewCat('');
      newCatRef.current?.focus();
    } catch { showToast('Ошибка', 'error'); }
    setCatSaving(false);
  }

  async function deleteCategory(name: string) {
    try {
      const res = await fetch('/api/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, type: manageTab }),
      });
      const d = await res.json();
      if (d.ok) {
        applyCats(d);
        if (opCat === name) setOpCat(d[activeCatType]?.[0] ?? '');
        showToast(`«${name}» удалена`, 'success');
      }
    } catch { showToast('Ошибка', 'error'); }
  }

  async function syncValidation() {
    setSyncSaving(true);
    try {
      await fetch('/api/categories', { method: 'PUT' });
      showToast('Дропдаун в таблице обновлён ✓', 'success');
    } catch { showToast('Ошибка синхронизации', 'error'); }
    setSyncSaving(false);
  }

  const btnStyle = (saving: boolean): React.CSSProperties => ({
    marginTop: 16, background: C.blue, color: '#fff', border: 'none',
    borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600,
    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1,
  });

  const currentList = cats[manageTab];

  return (
    <>
    <Toast message={toast.message} type={toast.type} onHide={hideToast} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="grid-2">

        {/* Форма операции */}
        <div style={card}>
          <div style={cardTitle}>💰 Записать операцию</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Тип">
              <select style={inputS} value={opType} onChange={e => setOpType(e.target.value)}>
                {TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Дата">
              <input style={inputS} type="date" value={opDate} onChange={e => setOpDate(e.target.value)} />
            </Field>
            <Field label="Сумма (₽)">
              <input style={inputS} type="number" placeholder="0" value={opAmt} onChange={e => setOpAmt(e.target.value)} />
            </Field>
            <Field label="Категория">
              <select style={inputS} value={opCat} onChange={e => setOpCat(e.target.value)} disabled={!catsReady}>
                {activeCats.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <div style={{ gridColumn: '1/-1' }}>
              <Field label="Описание">
                <input style={inputS} placeholder="Необязательно" value={opDesc} onChange={e => setOpDesc(e.target.value)} />
              </Field>
            </div>
          </div>
          <button onClick={saveOp} disabled={opSaving} style={btnStyle(opSaving)}>
            💾 {opSaving ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>

        {/* Форма смены */}
        <div style={card}>
          <div style={cardTitle}>📅 Записать смену</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <Field label="Дата">
                <input style={inputS} type="date" value={shDate} onChange={e => setShDate(e.target.value)} />
              </Field>
            </div>
            <Field label="📱 Телефоны (шт.)">
              <input style={inputS} type="number" placeholder="0" value={shPhone} onChange={e => setShPhone(e.target.value)} />
            </Field>
            <Field label="🎧 Аксессуары (₽)">
              <input style={inputS} type="number" placeholder="0" value={shAcc} onChange={e => setShAcc(e.target.value)} />
            </Field>
            <Field label="💻 Техника ВП (₽)">
              <input style={inputS} type="number" placeholder="0" value={shTech} onChange={e => setShTech(e.target.value)} />
            </Field>
            <Field label="🛠 Услуги (₽)">
              <input style={inputS} type="number" placeholder="0" value={shSvc} onChange={e => setShSvc(e.target.value)} />
            </Field>
          </div>
          <p style={{ marginTop: 12, fontSize: 12, color: C.sub }}>💡 ЗП рассчитывается автоматически по формуле в таблице</p>
          <button onClick={saveShift} disabled={shSaving} style={btnStyle(shSaving)}>
            💾 {shSaving ? 'Сохраняю…' : 'Сохранить смену'}
          </button>
        </div>

      </div>

      {/* Управление категориями */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={cardTitle}>🏷️ Категории</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={syncValidation} disabled={syncSaving}
              title="Обновить выпадающий список в Google Таблице"
              style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.sub, fontSize: 12, cursor: syncSaving ? 'not-allowed' : 'pointer', opacity: syncSaving ? .6 : 1 }}>
              🔄 Синхр. таблицу
            </button>
            <button onClick={() => setShowManage(v => !v)}
              style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.sub, fontSize: 12, cursor: 'pointer' }}>
              {showManage ? 'Скрыть' : 'Управление'}
            </button>
          </div>
        </div>

        {/* 4 таба */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: C.surface2, borderRadius: 10, padding: 4 }}>
          {MANAGE_TABS.map(tab => (
            <button key={tab.key} onClick={() => { setManageTab(tab.key); setNewCat(''); }}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: '.15s',
                background: manageTab === tab.key ? C.surface : 'transparent',
                color: manageTab === tab.key ? C.text : C.sub,
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Чипы */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: showManage ? 14 : 0 }}>
          {currentList.map(cat => (
            <div key={cat} style={{
              display: 'flex', alignItems: 'center', gap: showManage ? 4 : 0,
              background: C.surface2, border: `1px solid ${C.border}`,
              borderRadius: 20, padding: showManage ? '5px 8px 5px 14px' : '5px 12px',
              fontSize: 13, color: C.text,
            }}>
              <span>{cat}</span>
              {showManage && (
                <button onClick={() => deleteCategory(cat)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sub, fontSize: 15, lineHeight: 1, padding: '0 3px' }}>
                  ×
                </button>
              )}
            </div>
          ))}
          {currentList.length === 0 && <span style={{ color: C.sub, fontSize: 13 }}>Нет категорий</span>}
        </div>

        {/* Добавить */}
        {showManage && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={newCatRef} type="text" value={newCat}
              onChange={e => setNewCat(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
              placeholder={`Новая категория (${MANAGE_TABS.find(t => t.key === manageTab)?.label.replace(/^.+ /, '')})…`}
              style={{ ...inputS, flex: 1 }}
            />
            <button onClick={addCategory} disabled={catSaving || !newCat.trim()}
              style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: catSaving || !newCat.trim() ? 'not-allowed' : 'pointer', opacity: catSaving || !newCat.trim() ? .5 : 1, whiteSpace: 'nowrap' }}>
              + Добавить
            </button>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
