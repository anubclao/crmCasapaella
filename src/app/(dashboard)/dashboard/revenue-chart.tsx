/**
 * Inline SVG bar chart — last 30 days of revenue.
 * No chart library dep (keeps the bundle small for shared hosting).
 * Renders an empty-state placeholder if there's no data yet.
 */
type Point = { day: string; amount: number };

export function RevenueChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-granate-700/50 border-2 border-dashed border-granate-100 rounded-xl">
        Aún no hay ingresos registrados. Vuelve cuando lleguen los primeros pedidos 🛵
      </div>
    );
  }

  const W = 800;
  const H = 180;
  const PADDING = { top: 12, right: 12, bottom: 28, left: 48 };
  const innerW = W - PADDING.left - PADDING.right;
  const innerH = H - PADDING.top - PADDING.bottom;

  const max = Math.max(...data.map((d) => d.amount), 1);
  const barW = innerW / data.length - 2; // 2px gap
  const niceMax = niceCeil(max);

  // Y-axis ticks (4 of them)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => niceMax * p);

  const fmtK = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
    return `$${n}`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" preserveAspectRatio="none">
        {/* Y-axis grid lines + labels */}
        {yTicks.map((t, i) => {
          const y = PADDING.top + innerH - (t / niceMax) * innerH;
          return (
            <g key={i}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={PADDING.left + innerW}
                y2={y}
                stroke="#F0E4C2"
                strokeDasharray="2 3"
              />
              <text
                x={PADDING.left - 6}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                fill="#7C1419"
                opacity="0.6"
              >
                {fmtK(t)}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const h = (d.amount / niceMax) * innerH;
          const x = PADDING.left + i * (barW + 2);
          const y = PADDING.top + innerH - h;
          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                fill="#C1272D"
                rx="2"
                opacity="0.85"
              >
                <title>
                  {d.day}: {fmtK(d.amount)}
                </title>
              </rect>
            </g>
          );
        })}

        {/* X-axis labels (every 5th day) */}
        {data.map((d, i) => {
          if (i % 5 !== 0 && i !== data.length - 1) return null;
          const x = PADDING.left + i * (barW + 2) + barW / 2;
          const day = d.day.slice(5); // MM-DD
          return (
            <text
              key={d.day}
              x={x}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fill="#7C1419"
              opacity="0.6"
            >
              {day}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const m = n / base;
  let nice: number;
  if (m <= 1) nice = 1;
  else if (m <= 2) nice = 2;
  else if (m <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}
