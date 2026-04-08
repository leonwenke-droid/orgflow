import type { MonthBarDatum } from "../../lib/financeLedger";

const GREEN = "#639922";
const RED = "#E24B4A";

export default function FinanceSixMonthChart({ title, months }: { title: string; months: MonthBarDatum[] }) {
  const W = 720;
  const H = 220;
  const padL = 24;
  const padR = 24;
  const padB = 36;
  const padT = 8;
  const chartH = H - padB - padT;
  const innerW = W - padL - padR;
  const groupW = innerW / Math.max(months.length, 1);
  const max = Math.max(1, ...months.flatMap((m) => [m.incomeCents, m.expenseCents]));
  const barW = groupW * 0.22;
  const gap = groupW * 0.06;

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-secondary p-4 dark:border-border-default dark:bg-bg-primary">
      <h3 className="mb-4 text-sm font-semibold text-text-primary">{title}</h3>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className="text-text-muted"
        role="img"
        aria-label={title}
      >
        {months.map((m, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const incomeH = (m.incomeCents / max) * chartH;
          const expenseH = (m.expenseCents / max) * chartH;
          const incomeY = padT + chartH - incomeH;
          const expenseY = padT + chartH - expenseH;
          return (
            <g key={m.key}>
              <rect
                x={cx - barW - gap / 2}
                y={incomeY}
                width={barW}
                height={Math.max(incomeH, 1)}
                fill={GREEN}
                rx={2}
              />
              <rect
                x={cx + gap / 2}
                y={expenseY}
                width={barW}
                height={Math.max(expenseH, 1)}
                fill={RED}
                rx={2}
              />
              <text
                x={cx}
                y={H - 10}
                textAnchor="middle"
                fill="currentColor"
                className="text-xs"
                style={{ fontSize: 12 }}
              >
                {m.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
