"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

type TargetType = "all" | "tag" | "inactive_days";

export default function NewCampaignPage() {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("¡Hola {{nombre}}! 🍤 Te esperamos en Casa Paella este viernes con 2x1 en paellas. Reserva respondiendo a este mensaje.");
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetValue, setTargetValue] = useState("");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [recipients, setRecipients] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live preview of recipient count (debounced)
  useEffect(() => {
    const params = new URLSearchParams();
    params.set("type", targetType);
    if (targetType !== "all" && targetValue) params.set("value", targetValue);
    const t = setTimeout(() => {
      fetch(`/api/campaigns/audience?${params.toString()}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((data) => {
          if (data.ok) setRecipients(data.count);
          else setRecipients(null);
        })
        .catch(() => setRecipients(null));
    }, 300);
    return () => clearTimeout(t);
  }, [targetType, targetValue]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = { title, message, targetType };
    if (targetType !== "all") payload.targetValue = targetValue;
    if (scheduleLater && scheduledAt) payload.scheduledAt = new Date(scheduledAt).toISOString();

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error al crear la campaña");
        return;
      }
      startTransition(() => router.push(`/campaigns/${data.id}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  // Tiny preview of variables in the message
  const renderedPreview = message
    .replace(/\{\{nombre\}\}/g, "Juan")
    .replace(/\{\{nombre_completo\}\}/g, "Juan Pérez")
    .replace(/\{\{pedidos\}\}/g, "3")
    .replace(/\{\{total_gastado\}\}/g, "180.000");

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl text-granate-800 mb-1">Nueva campaña</h1>
      <p className="text-sm text-granate-700/60 mb-6">
        Envía un mensaje a un grupo de clientes. Usa <code className="bg-crema-100 px-1 rounded">{"{{nombre}}"}</code> y otras variables para personalizar.
      </p>

      <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">{error}</div>
        )}

        <Field label="Título interno">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            maxLength={255}
            placeholder="Promo 2x1 paellas — viernes"
            className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
          />
        </Field>

        <Field
          label="Mensaje"
          hint="Variables: {{nombre}}, {{nombre_completo}}, {{pedidos}}, {{total_gastado}}"
        >
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            rows={6}
            maxLength={4096}
            className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400 font-mono text-sm"
          />
          <div className="mt-2 p-3 rounded-lg bg-crema-100 border border-granate-100 text-sm text-granate-800 whitespace-pre-wrap">
            {renderedPreview || <span className="text-granate-700/50">Vista previa…</span>}
          </div>
        </Field>

        <Field label="Audiencia">
          <div className="space-y-2">
            <RadioRow
              name="target"
              checked={targetType === "all"}
              onChange={() => { setTargetType("all"); setTargetValue(""); }}
              label="Todos los clientes con teléfono"
            />
            <RadioRow
              name="target"
              checked={targetType === "tag"}
              onChange={() => setTargetType("tag")}
              label="Por etiqueta"
            />
            {targetType === "tag" && (
              <input
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="VIP, Frecuente, Cliente Nuevo…"
                required
                className="ml-6 w-full max-w-xs px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400 text-sm"
              />
            )}
            <RadioRow
              name="target"
              checked={targetType === "inactive_days"}
              onChange={() => setTargetType("inactive_days")}
              label="Inactivos hace"
            />
            {targetType === "inactive_days" && (
              <div className="ml-6 flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  value={targetValue}
                  onChange={(e) => setTargetValue(e.target.value)}
                  required
                  className="w-24 px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400 text-sm"
                />
                <span className="text-sm text-granate-700">días o más sin actividad</span>
              </div>
            )}
          </div>
          <div className="mt-3 text-sm text-granate-700">
            {recipients === null ? (
              <span className="text-granate-700/50">Calculando…</span>
            ) : (
              <>
                <strong className="text-granate-800 text-base">{recipients}</strong> cliente{recipients === 1 ? "" : "s"} recibirán este mensaje.
              </>
            )}
          </div>
        </Field>

        <Field label="Programación">
          <div className="space-y-2">
            <RadioRow
              name="schedule"
              checked={!scheduleLater}
              onChange={() => setScheduleLater(false)}
              label="Enviar cuando dé clic en 'Enviar ahora' (queda como borrador)"
            />
            <RadioRow
              name="schedule"
              checked={scheduleLater}
              onChange={() => setScheduleLater(true)}
              label="Programar para"
            />
            {scheduleLater && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                required
                className="ml-6 px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400 text-sm"
              />
            )}
          </div>
        </Field>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-granate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting || recipients === 0}
            className="px-5 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creando…" : scheduleLater ? "Programar campaña" : "Crear borrador"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm font-medium text-granate-800">{label}</span>
        {hint && <span className="text-xs text-granate-700/60">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function RadioRow({ name, checked, onChange, label }: { name: string; checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="accent-granate-500" />
      <span className="text-sm text-granate-800">{label}</span>
    </label>
  );
}
