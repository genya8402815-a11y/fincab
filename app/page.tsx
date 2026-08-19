'use client';

import { useState } from 'react';
import Navigation, { type Section } from '@/components/Navigation';
import Dashboard from '@/components/Dashboard';
import AddRecord  from '@/components/AddRecord';
import Journal    from '@/components/Journal';
import Goals      from '@/components/Goals';
import Shifts     from '@/components/Shifts';
import Salary     from '@/components/Salary';
import Debts      from '@/components/Debts';
import PushSetup  from '@/components/PushSetup';

export default function Home() {
  const [active, setActive] = useState<Section>('dashboard');
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navigation active={active} onChange={setActive} />
      <div className="page-wrap">
        {active === 'dashboard' && <><PushSetup /><Dashboard /></>}
        {active === 'add'       && <AddRecord />}
        {active === 'journal'   && <Journal />}
        {active === 'shifts'    && <Shifts />}
        {active === 'salary'    && <Salary />}
        {active === 'debts'     && <Debts />}
        {active === 'goals'     && <Goals />}
      </div>
    </div>
  );
}
