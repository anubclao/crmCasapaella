import { getDashboardStats } from "@/server/stats";
import { RevenueChart } from "./revenue-chart";

const fmtCOP = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

export default async function DashboardPage() {
  const stats = await getDashboardStats();
  return (
    <div className="space-y-8">
      {/* Top KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="Clientes totales" value={stats.totalCustomers.toString()} icon="👥" />
        <Kpi label="Reservas (mes)" value={stats.totalReservations.month.toString()} icon="📅" />
        <Kpi label="Pedidos (mes)" value={stats.totalOrders.month.toString()} icon="🛵" />
        <Kpi label="Ingresos (mes)" value={fmtCOP(stats.revenue.month)} icon="💰" highlight />
      </div>

      {/* Revenue breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi label="Ingresos hoy" value={fmtCOP(stats.revenue.today)} subtle />
        <Kpi label="Ingresos 7 días" value={fmtCOP(stats.revenue.week)} subtle />
        <Kpi label="LTV total" value={fmtCOP(stats.revenue.total)} subtle />
      </div>

      {/* Revenue chart 30 days */}
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
        <h2 className="font-display text-xl text-granate-800 mb-4">Ingresos · últimos 30 días</h2>
        <RevenueChart data={stats.revenueDaily} />
      </div>

      {/* Two columns: top customers + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Top clientes (LTV)">
          {stats.topCustomers.length === 0 ? (
            <p className="text-granate-700/60 text-sm">Aún no hay clientes con pedidos.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-granate-700/60 border-b border-granate-100">
                  <th className="pb-2">Cliente</th>
                  <th className="pb-2">Pedidos</th>
                  <th className="pb-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {stats.topCustomers.map((c) => (
                  <tr key={c.id} className="border-b border-granate-50">
                    <td className="py-2.5 font-medium text-granate-800">{c.name}</td>
                    <td className="py-2.5 text-granate-700">{c.total_orders}</td>
                    <td className="py-2.5 text-right font-medium text-granate-800">{fmtCOP(Number(c.total_spent))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Actividad reciente">
          {stats.recentActivity.length === 0 ? (
            <p className="text-granate-700/60 text-sm">Sin actividad reciente.</p>
          ) : (
            <ul className="space-y-2">
              {stats.recentActivity.map((a) => (
                <li key={`${a.type}-${a.id}`} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="mr-2">{a.type === "order" ? "🛵" : "📅"}</span>
                    <span className="font-medium text-granate-800">{a.customer_name}</span>
                    <span className="text-granate-700/60 ml-2">— {a.status}</span>
                  </div>
                  <div className="text-granate-700/60 text-xs">{fmtDate(a.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ label, value, icon, highlight, subtle }: { label: string; value: string; icon?: string; highlight?: boolean; subtle?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 border ${
        highlight
          ? "bg-granate-500 text-white border-granate-600 shadow-warm-lg"
          : subtle
          ? "bg-white border-granate-100"
          : "bg-white border-granate-100 shadow-warm"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-xs uppercase tracking-wide ${highlight ? "text-crema-100/80" : "text-granate-700/60"}`}>{label}</div>
          <div className={`text-2xl font-display mt-1 ${highlight ? "text-white" : "text-granate-800"}`}>{value}</div>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
      <h2 className="font-display text-xl text-granate-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}
