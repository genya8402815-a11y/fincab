import { NextResponse } from 'next/server';
import { readRange } from '@/lib/sheets';
import nodemailer from 'nodemailer';

function n(v?: string) { return parseFloat(String(v ?? '0').replace(/\s/g, '').replace(',', '.')) || 0; }
function money(v: number) { return v.toLocaleString('ru-RU') + ' ₽'; }

const RU_MONTHS = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function prevMonthLabel(): { mm: string; yyyy: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mm   = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  const label = `${RU_MONTHS[d.getMonth()]} ${yyyy}`;
  return { mm, yyyy, label };
}

function buildHtml(
  period: string,
  income: number,
  expenses: number,
  balance: number,
  savingsRate: number,
  topCats: { cat: string; amt: number; pct: number }[],
) {
  const balColor = balance >= 0 ? '#4ade80' : '#f87171';
  const catsRows = topCats.map(({ cat, amt, pct }) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2d3148;">${cat}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2d3148;text-align:right;font-weight:600;">${money(amt)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2d3148;text-align:right;color:#8892a4;">${pct.toFixed(0)}%</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><title>FinCab — отчёт ${period}</title></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;color:#e2e8f0;">
  <div style="max-width:520px;margin:32px auto;background:#1a1d27;border-radius:16px;overflow:hidden;">

    <!-- Header -->
    <div style="background:#6c8ef7;padding:24px 28px;">
      <div style="font-size:22px;font-weight:700;color:#fff;">💰 ФИНКАБ</div>
      <div style="font-size:14px;color:rgba(255,255,255,.8);margin-top:4px;">Ежемесячный отчёт · ${period}</div>
    </div>

    <!-- KPI -->
    <div style="display:flex;gap:0;border-bottom:1px solid #2d3148;">
      <div style="flex:1;padding:20px 24px;border-right:1px solid #2d3148;">
        <div style="font-size:11px;color:#8892a4;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Доходы</div>
        <div style="font-size:20px;font-weight:700;color:#4ade80;">${money(income)}</div>
      </div>
      <div style="flex:1;padding:20px 24px;border-right:1px solid #2d3148;">
        <div style="font-size:11px;color:#8892a4;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Расходы</div>
        <div style="font-size:20px;font-weight:700;color:#f87171;">${money(expenses)}</div>
      </div>
      <div style="flex:1;padding:20px 24px;">
        <div style="font-size:11px;color:#8892a4;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">Баланс</div>
        <div style="font-size:20px;font-weight:700;color:${balColor};">${money(balance)}</div>
      </div>
    </div>

    <!-- Savings rate -->
    <div style="padding:16px 24px;border-bottom:1px solid #2d3148;background:#222535;">
      <span style="color:#8892a4;font-size:13px;">Норма накоплений: </span>
      <span style="font-size:13px;font-weight:700;color:${savingsRate >= 20 ? '#4ade80' : savingsRate >= 10 ? '#fbbf24' : '#f87171'};">${savingsRate.toFixed(1)}%</span>
      <span style="color:#8892a4;font-size:12px;margin-left:8px;">(рекомендуется ≥ 20%)</span>
    </div>

    <!-- Top categories -->
    ${topCats.length > 0 ? `
    <div style="padding:20px 24px 8px;">
      <div style="font-size:12px;font-weight:600;color:#8892a4;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;">Топ категорий расходов</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        ${catsRows}
      </table>
    </div>` : ''}

    <!-- Footer -->
    <div style="padding:20px 24px;color:#8892a4;font-size:12px;text-align:center;">
      Открыть ФИНКАБ → <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://fincab.vercel.app'}" style="color:#6c8ef7;">fincab.vercel.app</a>
    </div>
  </div>
</body>
</html>`;
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET не задан' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const emailTo   = process.env.EMAIL_TO ?? emailUser;

  if (!emailUser || !emailPass)
    return NextResponse.json({ error: 'EMAIL_USER / EMAIL_PASS не заданы' }, { status: 500 });

  try {
    const { mm, yyyy, label } = prevMonthLabel();

    // Читаем все операции журнала
    const rows = await readRange("'💰 Журнал операций'!B5:G2000");
    const entries = rows.filter(r => {
      const date = String(r[0] ?? '');
      const parts = date.split('.');
      return parts.length === 3 && parts[1] === mm && parts[2] === yyyy;
    });

    let income   = 0;
    let expenses = 0;
    const catMap = new Map<string, number>();

    for (const r of entries) {
      const type = String(r[1] ?? '');
      const amt  = n(r[2]);
      const cat  = String(r[3] ?? 'Прочее') || 'Прочее';
      if (type === 'Доход')   income   += amt;
      if (type === 'Расход') { expenses += amt; catMap.set(cat, (catMap.get(cat) ?? 0) + amt); }
    }

    const balance      = income - expenses;
    const savingsRate  = income > 0 ? ((income - expenses) / income) * 100 : 0;

    const topCats = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([cat, amt]) => ({ cat, amt, pct: expenses > 0 ? (amt / expenses) * 100 : 0 }));

    const html = buildHtml(label, income, expenses, balance, savingsRate, topCats);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: emailUser, pass: emailPass },
    });

    await transporter.sendMail({
      from: `"ФИНКАБ" <${emailUser}>`,
      to: emailTo,
      subject: `ФИНКАБ — отчёт за ${label}`,
      html,
    });

    return NextResponse.json({ ok: true, period: label, income, expenses, balance, entries: entries.length });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
