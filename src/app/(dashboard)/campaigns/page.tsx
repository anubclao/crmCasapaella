import Link from "next/link";
import { listCampaigns } from "@/server/campaigns";

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso)) : "—";

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-dorado-100 text-dorado-700",
  sent: "bg-green-100 text-green-700",
  cancelled: "bg-granate-100 text-granate-700",
};

const targetLabel = (type: string, value: string | null) => {
  if (type === "all") return "Todos";
  if (type === "tag") return `Tag: ${value}`;
  if (type === "inactive_days") return `Inactivos ${value}+d`;
  return type;
};

export default async function CampaignsPage() {
  const rows = await listCampaigns();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-granate-800">Campañas</h1>
          <p className="text-sm text-granate-700/60">Envíos masivos de WhatsApp</p>
        </div>
        <Link
          href="/campaigns/new"
          className="px-4 py-2 bg-granate-500 text-white rounded-lg text-sm hover:bg-granate-600 shadow-warm"
        >
          + Nueva campaña
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-crema-100 border-b border-granate-100">
            <tr className="text-left text-granate-700">
              <th className="px-4 py-3 font-medium">Título</th>
              <th className="px-4 py-3 font-medium">Audiencia</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Recip.</th>
              <th className="px-4 py-3 font-medium text-right">Entreg.</th>
              <th className="px-4 py-3 font-medium text-right">Fallos</th>
              <th className="px-4 py-3 font-medium">Programada</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-granate-700/60">
                  Aún no has creado campañas.{" "}
                  <Link href="/campaigns/new" className="text-granate-600 hover:underline">
                    Crea la primera →
                  </Link>
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-b border-granate-50 hover:bg-crema-50">
                  <td className="px-4 py-3">
                    <Link href={`/campaigns/${c.id}`} className="font-medium text-granate-800 hover:text-granate-600">
                      {c.title}
                    </Link>
                    <div className="text-xs text-granate-700/50">#{c.id}</div>
                  </td>
                  <td className="px-4 py-3 text-granate-700 text-xs">{targetLabel(c.target_type, c.target_value)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor[c.status]}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-granate-700">{c.recipients_count}</td>
                  <td className="px-4 py-3 text-right text-granate-700">{c.delivered_count}</td>
                  <td className="px-4 py-3 text-right text-granate-700">{c.failed_count}</td>
                  <td className="px-4 py-3 text-granate-700/70 text-xs whitespace-nowrap">{fmtDate(c.scheduled_at)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
