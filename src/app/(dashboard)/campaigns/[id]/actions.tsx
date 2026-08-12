"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";

type Status = "draft" | "scheduled" | "sending" | "sent" | "cancelled";

/**
 * Action buttons for a campaign: Send Now / Cancel.
 * Also auto-refreshes the page every 5s while status === "sending" so
 * the operator sees live progress without manual reload.
 */
export function CampaignActions({ campaignId, status }: { campaignId: number; status: Status }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "sending") return;
    const t = setInterval(() => {
      startTransition(() => router.refresh());
    }, 5000);
    return () => clearInterval(t);
  }, [status, router]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/send`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("¿Cancelar esta campaña? Los mensajes ya enviados no se pueden deshacer.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/cancel`, { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error");
        return;
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {(status === "draft" || status === "scheduled") && (
          <button
            onClick={send}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50"
          >
            {busy ? "Iniciando…" : status === "scheduled" ? "Enviar ahora" : "Enviar ahora"}
          </button>
        )}
        {(status === "scheduled" || status === "sending" || status === "draft") && (
          <button
            onClick={cancel}
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-granate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>
      {error && <div className="text-xs text-granate-600">{error}</div>}
    </div>
  );
}
