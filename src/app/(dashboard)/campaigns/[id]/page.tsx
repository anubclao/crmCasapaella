import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getCampaign,
  countCampaignMessages,
  listCampaignMessages,
} from "@/server/campaigns";
import { CampaignActions } from "./actions";

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

const statusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  scheduled: "bg-blue-100 text-blue-700",
  sending: "bg-dorado-100 text-dorado-700",
  sent: "bg-green-100 text-green-700",
  cancelled: "bg-granate-100 text-granate-700",
};

const messageStatusColor: Record<string, string> = {
  queued: "bg-gray-100 text-gray-700",
  sent: "bg-green-100 text-green-700",
  delivered: "bg-green-200 text-green-800",
  read: "bg-blue-100 text-blue-700",
  failed: "bg-granate-100 text-granate-700",
};

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) notFound();
  const campaign = await getCampaign(cid);
  if (!campaign) notFound();

  const [counters, messages] = await Promise.all([
    countCampaignMessages(cid),
    listCampaignMessages(cid, 50),
  ]);

  const progressPct =
    campaign.recipients_count > 0
      ? Math.min(100, Math.round((counters.total / campaign.recipients_count) * 100))
      : 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <Link href="/campaigns" className="text-sm text-granate-600 hover:underline">← Volver a campañas</Link>
        <a
          href={`/api/campaigns/${campaign.id}/export`}
          className="text-sm text-granate-600 hover:underline"
        >
          📥 Exportar destinatarios
        </a>
      </div>

      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor[campaign.status]}`}>
                {campaign.status}
              </span>
              <span className="text-xs text-granate-700/60">#{campaign.id}</span>
            </div>
            <h1 className="font-display text-3xl text-granate-800">{campaign.title}</h1>
            <div className="text-sm text-granate-700/60 mt-1">
              {campaign.target_type === "all" && "Todos los clientes con teléfono"}
              {campaign.target_type === "tag" && `Etiqueta: ${campaign.target_value}`}
              {campaign.target_type === "inactive_days" && `Inactivos ${campaign.target_value}+ días`}
              {campaign.scheduled_at && <> · Programada: {fmtDate(campaign.scheduled_at)}</>}
            </div>
          </div>
          <CampaignActions campaignId={campaign.id} status={campaign.status} />
        </div>

        <div className="mt-5 p-4 rounded-lg bg-crema-50 border border-granate-100">
          <div className="text-xs uppercase tracking-wide text-granate-700/60 mb-1">Mensaje</div>
          <div className="text-sm text-granate-800 whitespace-pre-wrap">{campaign.message}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Recipients" value={campaign.recipients_count} />
        <Stat label="Enviados" value={counters.sent} accent="green" />
        <Stat label="Fallos" value={counters.failed} accent={counters.failed > 0 ? "granate" : undefined} />
        <Stat label="Progreso" value={`${progressPct}%`} />
      </div>

      {/* Progress bar (auto-refreshes via client component) */}
      {campaign.status === "sending" && (
        <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-granate-800">Enviando…</div>
            <div className="text-xs text-granate-700/60">{counters.total} / {campaign.recipients_count}</div>
          </div>
          <div className="h-2 bg-crema-100 rounded-full overflow-hidden">
            <div className="h-full bg-granate-500 transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-xs text-granate-700/50 mt-2">La página se actualiza cada 5 segundos.</div>
        </div>
      )}

      {/* Per-recipient message log */}
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <div className="px-6 py-4 border-b border-granate-100 flex items-center justify-between">
          <h2 className="font-display text-xl text-granate-800">Mensajes</h2>
          <span className="text-xs text-granate-700/60">Últimos 50</span>
        </div>
        {messages.length === 0 ? (
          <div className="px-6 py-12 text-center text-granate-700/60 text-sm">
            Aún no hay mensajes. Inicia el envío con el botón "Enviar ahora".
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-crema-100 border-b border-granate-100">
              <tr className="text-left text-granate-700">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Mensaje</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id} className="border-b border-granate-50 align-top">
                  <td className="px-4 py-3">
                    <div className="font-medium text-granate-800">{m.customer_name ?? "—"}</div>
                    <div className="text-xs text-granate-700/60">{m.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-granate-800 max-w-md whitespace-pre-wrap">{m.body}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${messageStatusColor[m.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {m.status}
                    </span>
                    {m.error && <div className="text-xs text-granate-600 mt-1">{m.error}</div>}
                  </td>
                  <td className="px-4 py-3 text-granate-700/70 text-xs whitespace-nowrap">{fmtDateTime(m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: "green" | "granate" }) {
  const cls =
    accent === "green"
      ? "text-green-700"
      : accent === "granate"
      ? "text-granate-600"
      : "text-granate-800";
  return (
    <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-5">
      <div className="text-xs uppercase tracking-wide text-granate-700/60">{label}</div>
      <div className={`font-display text-2xl mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
