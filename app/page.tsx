'use client';

import { useState } from 'react';
import Navigation, { type Section } from '@/components/Navigation';
import Dashboard    from '@/components/Dashboard';
import AddRecord    from '@/components/AddRecord';
import Journal      from '@/components/Journal';
import Finance      from '@/components/Finance';
import Planning     from '@/components/Planning';
import Shifts       from '@/components/Shifts';
import ErrorBoundary   from '@/components/ErrorBoundary';
import PushSetup       from '@/components/PushSetup';
import OfflineBanner   from '@/components/OfflineBanner';

export default function Home() {
  const [active, setActive] = useState<Section>('dashboard');
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navigation active={active} onChange={setActive} />
      <OfflineBanner />
      <div className="page-wrap">
        {active === 'dashboard' && <ErrorBoundary section="Дашборд"><PushSetup /><Dashboard /></ErrorBoundary>}
        {active === 'add'       && <ErrorBoundary section="Записать"><AddRecord /></ErrorBoundary>}
        {active === 'journal'   && <ErrorBoundary section="Журнал"><Journal /></ErrorBoundary>}
        {active === 'shifts'    && <ErrorBoundary section="Смены"><Shifts /></ErrorBoundary>}
        {active === 'finance'   && <ErrorBoundary section="Финансы"><Finance /></ErrorBoundary>}
        {active === 'planning'  && <ErrorBoundary section="Планирование"><Planning /></ErrorBoundary>}
      </div>
    </div>
  );
}
