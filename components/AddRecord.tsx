'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Toast from '@/components/Toast';

const C = { blue: '#6c8ef7', green: '#4ade80', red: '#f87171', sub: '#8892a4', border: '#2d3148', surface: '#1a1d27', surface2: '#222535', text: '#e2e8f0', yellow: '#fbbf24' };

function toRuDate(iso: string) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function todayIso() { return new Date().toISOString().slice(0, 10); }

const TYPES = ['🛒 Расход', '💵 Доход', '🏦 В накопления', '↩️ Из накоплений', '💳 Платёж по долгу'];
const FALLBACK_CATS = ['Продукты', 'Транспорт', 'Кафе и рестораны', 'Связь', 'Развлечения', 'Подписки', 'Здоровье', 'Прочее'];

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

  // Категории
  const [cats,      setCats]     = useState<string[]>(FALLBACK_CATS);
  const [catsReady, setCatsReady] = useState(false);
  const [newCat,    setNewCat]   = useState('');
  const [catSaving, setCatSaving] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const newCatRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => setToast({ message, type });
  const hideToast = useCallback(() => setToast({ message: '', type: '' }), []);

  const [opDate, setOpDate] = useState(todayIso());
  const [opType, setOpType] = useState(TYPES[0]);
  const [opAmt,  setOpAmt]  = useState('');
  const [opCat,  setOpCat]  = useState(FALLBACK_CATS[0]);
  const [opDesc, setOpDesc] = useState('');

  const [shDate,  setShDate]  = useState(todayIso());
  const [shPhone, setShPhone] = useState('');
  const [shAcc,   setShAcc]   = useState('');
  const [shTech,  setShTech]  = useState('');
  const [shSvc,   setShSvc]   = useState('');

  // Загружаем категории при монтировании
  useEffect(() => {
    fetch('/api/categories').then(r => r.json()).then(d => {
      const c: string[] = d.categories ?? [];
      if (c.length > 0) {
        setCats(c);
        setOpCat(c[0]);
      }
      setCatsReady(true);
    }).catch(() => setCatsReady(true));
  }, []);

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
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (d.categories) { setCats(d.categories); showToast(`Категория «${name}» добавлена`, 'success'); }
      else if (d.action === 'already_exists') showToast('Такая категория уже есть', 'error');
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
        body: JSON.stringify({ name }),
      });
      const d = await res.json();
      if (d.categories) {
        setCats(d.categories);
        if (opCat === name) setOpCat(d.categories[0] ?? '');
        showToast(`Категория «${name}» удалена`, 'success');
      }
    } catch { showToast('Ошибка', 'error'); }
  }

  const btnStyle = (saving: boolean): React.CSSProperties => ({
    marginTop: 16, background: C.blue, color: '#fff', border: 'none',
    borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 600,
    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1,
  });

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
              <select style={inputS} value={opCat} onChange={e => setOpCat(e.target.value)}
                disabled={!catsReady}>
                {cats.map(c => <option key={c}>{c}</option>)}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showManage ? 16 : 0 }}>
          <div style={cardTitle}>🏷️ Категории расходов</div>
          <button
            onClick={() => setShowManage(v => !v)}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, borderRadius: 8, padding: '5px 12px', color: C.sub, fontSize: 12, cursor: 'pointer' }}
          >
            {showManage ? 'Скрыть' : 'Управление'}
          </button>
        </div>

        {showManage && (
          <>
            {/* Чипы существующих категорий */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {cats.map(cat => (
                <div key={cat} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: C.surface2, border: `1px solid ${C.border}`,
                  borderRadius: 20, padding: '5px 10px 5px 14px', fontSize: 13, color: C.text,
                }}>
                  <span>{cat}</span>
                  <button
                    onClick={() => deleteCategory(cat)}
                    title="Удалить"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sub, fontSize: 14, lineHeight: 1, padding: 2, borderRadius: '50%' }}
                  >×</button>
                </div>
              ))}
            </div>

            {/* Добавить новую */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={newCatRef}
                type="text"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addCategory(); }}
                placeholder="Новая категория…"
                style={{ ...inputS, flex: 1 }}
              />
              <button
                onClick={addCategory}
                disabled={catSaving || !newCat.trim()}
                style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: catSaving || !newCat.trim() ? 'not-allowed' : 'pointer', opacity: catSaving || !newCat.trim() ? .5 : 1, whiteSpace: 'nowrap' }}
              >
                + Добавить
              </button>
            </div>
          </>
        )}

        {!showManage && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.map(cat => (
              <span key={cat} style={{
                background: C.surface2, border: `1px solid ${C.border}`,
                borderRadius: 20, padding: '4px 12px', fontSize: 12, color: C.sub,
              }}>{cat}</span>
            ))}
          </div>
        )}
      </div>
    </div>
    </>
  );
}
