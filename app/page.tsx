'use client';

import { useState } from 'react';
import Navigation, { type Section } from '@/components/Navigation';
import Dashboard from '@/components/Dashboard';
import AddRecord  from '@/components/AddRecord';
import Journal    from '@/components/Journal';
import Finance    from '@/components/Finance';
import Planning   from '@/components/Planning';
import Shifts     from '@/components/Shifts';
import PushSetup     from '@/components/PushSetup';
import OfflineBanner from '@/components/OfflineBanner';

export default function Home() {
  const [active, setActive] = useState<Section>('dashboard');
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navigation active={active} onChange={setActive} />
      <OfflineBanner />
      <div className="page-wrap">
        {active === 'dashboard' && <><PushSetup /><Dashboard /></>}
        {active === 'add'       && <AddRecord />}
        {active === 'journal'   && <Journal />}
        {active === 'shifts'    && <Shifts />}
        {active === 'finance'   && <Finance />}
        {active === 'planning'  && <Planning />}
      </div>
    </div>
  );
}
