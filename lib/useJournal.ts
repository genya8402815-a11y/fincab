'use client';

import { useEffect, useRef, useState } from 'react';

export interface JournalEntry {
  date: string;
  type: string;
  amount: string;
  category: string;
  target: string;
  description: string;
}

// ─── Модульный кеш (живёт между рендерами, сбрасывается через TTL) ───────────

const CACHE_TTL = 60_000; // 60 секунд

let cachedEntries: JournalEntry[] | null = null;
let cacheTimestamp = 0;
let pendingFetch: Promise<JournalEntry[]> | null = null;

function isCacheFresh() {
  return cachedEntries !== null && Date.now() - cacheTimestamp <= CACHE_TTL;
}

function fetchJournal(): Promise<JournalEntry[]> {
  // Если запрос уже летит — ждём его, не дублируем
  if (pendingFetch) return pendingFetch;

  pendingFetch = fetch('/api/journal')
    .then(r => r.json())
    .then(d => {
      const entries: JournalEntry[] = d.entries ?? [];
      cachedEntries  = entries;
      cacheTimestamp = Date.now();
      pendingFetch   = null;
      return entries;
    })
    .catch(e => {
      pendingFetch = null;
      throw e;
    });

  return pendingFetch;
}

// ─── Хук ─────────────────────────────────────────────────────────────────────

/**
 * Хук для загрузки журнала операций с кешированием на 60 секунд.
 *
 * Первый компонент делает fetch, остальные получают данные из кеша мгновенно.
 * При переключении вкладок повторного запроса нет — данные уже в памяти.
 */
export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>(cachedEntries ?? []);
  const [loading, setLoading] = useState(!isCacheFresh());
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (isCacheFresh()) {
      setEntries(cachedEntries!);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchJournal()
      .then(data => {
        setEntries(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Ошибка загрузки журнала');
        setLoading(false);
      });
  }, []);

  return { entries, loading, error };
}

/**
 * Инвалидирует кеш — вызывать после записи новой операции,
 * чтобы следующее обращение к useJournal получило свежие данные.
 */
export function invalidateJournalCache() {
  cachedEntries  = null;
  cacheTimestamp = 0;
  pendingFetch   = null;
}
