'use client';

import { useEffect, useState } from 'react';

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

// ─── Сброс кеша при правках таблицы мимо сайта — ДОБАВЛЕНО 22.08.2026 (P3 #33) ───
//
// Раньше кеш сбрасывался ТОЛЬКО когда сам сайт записывал операцию
// (invalidateJournalCache() в AddRecord.tsx и т.п.). Если таблицу правили
// вручную в Google Таблице или через бота — открытая вкладка сайта об этом
// не знала до истечения 60-секундного TTL.
//
// Apps Script (onEdit-триггер + запись операций ботом) при каждой правке
// журнала "бампает" версию в Upstash Redis через /api/cache/version (POST).
// Здесь мы раз в VERSION_POLL_INTERVAL дёшево сверяем эту версию (GET) — если
// она выросла после того, как мы её уже видели, значит кто-то поправил
// таблицу без нас: сбрасываем кеш, перезапрашиваем журнал и уведомляем ВСЕ
// смонтированные компоненты, использующие useJournal(), через subscribers.
//
// Если Upstash не подключён — /api/cache/version всегда отдаёт version: 0,
// проверка молча ничего не делает, сайт работает как раньше (по TTL).

const VERSION_POLL_INTERVAL = 15_000;

let knownVersion = 0;
let pollTimer: ReturnType<typeof setInterval> | null = null;
const subscribers = new Set<(entries: JournalEntry[]) => void>();

async function checkVersionAndMaybeRefresh() {
  try {
    const res = await fetch('/api/cache/version');
    const { version } = await res.json();
    if (!version) return;
    const hadKnownVersion = knownVersion !== 0;
    if (version !== knownVersion) {
      knownVersion = version;
      if (hadKnownVersion) {
        invalidateJournalCache();
        const fresh = await fetchJournal();
        subscribers.forEach(cb => cb(fresh));
      }
    }
  } catch { /* сеть моргнула — не страшно, попробуем на следующем тике */ }
}

function ensurePolling() {
  if (pollTimer) return;
  checkVersionAndMaybeRefresh(); // сразу запоминаем текущую версию, без лишнего рефетча
  pollTimer = setInterval(checkVersionAndMaybeRefresh, VERSION_POLL_INTERVAL);
}

function stopPollingIfIdle() {
  if (subscribers.size === 0 && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ─── Хук ─────────────────────────────────────────────────────────────────────

/**
 * Хук для загрузки журнала операций с кешированием на 60 секунд.
 *
 * Первый компонент делает fetch, остальные получают данные из кеша мгновенно.
 * При переключении вкладок повторного запроса нет — данные уже в памяти.
 * Пока хук смонтирован, раз в 15 сек дёшево проверяет версию журнала и сам
 * обновляется, если таблицу поправили мимо сайта.
 */
export function useJournal() {
  const [entries, setEntries] = useState<JournalEntry[]>(cachedEntries ?? []);
  const [loading, setLoading] = useState(!isCacheFresh());
  const [error,   setError]   = useState('');

  useEffect(() => {
    subscribers.add(setEntries);
    ensurePolling();
    return () => {
      subscribers.delete(setEntries);
      stopPollingIfIdle();
    };
  }, []);

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
