"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Customer = { id: number; name: string; phone: string; email: string | null };

export default function NewReservationPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("19:30");
  const [guests, setGuests] = useState(2);
  const [notes, setNotes] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typeahead for customer search
  useEffect(() => {
    if (selected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      fetch(`/api/customers?${params.toString()}`, { credentials: "same-origin" })
        .then((r) => r.json())
        .then((d) => setResults(d.customers ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, selected]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Selecciona un cliente");
      return;
    }
    if (!date) {
      setError("Selecciona una fecha");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const dt = new Date(`${date}T${time}:00`);
      const res = await fetch("/api/reservations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected.id,
          reservationDate: dt.toISOString(),
          guests,
          notes: notes || undefined,
          sendWhatsapp,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error");
        return;
      }
      router.push(`/customers/${selected.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-granate-800 mb-1">Nueva reserva</h1>
      <p className="text-sm text-granate-700/60 mb-6">Crea una reserva manual (teléfono, walk-in)</p>

      <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-5">
        {error && <div className="p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">{error}</div>}

        <Field label="Cliente">
          {selected ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-granate-200 bg-crema-50">
              <div>
                <div className="font-medium text-granate-800">{selected.name}</div>
                <div className="text-xs text-granate-700/70">{selected.phone}</div>
              </div>
              <button
                type="button"
                onClick={() => { setSelected(null); setSearch(""); }}
                className="text-xs text-granate-600 hover:underline"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
                onFocus={() => setShowResults(true)}
                placeholder="Buscar por nombre, teléfono, email…"
                className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
              />
              {showResults && results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-granate-200 rounded-lg shadow-warm-lg max-h-60 overflow-y-auto">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => { setSelected(c); setShowResults(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-crema-50 border-b border-granate-50 last:border-0"
                    >
                      <div className="text-sm font-medium text-granate-800">{c.name}</div>
                      <div className="text-xs text-granate-700/70">{c.phone}{c.email ? ` · ${c.email}` : ""}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Fecha" col={2}>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
            />
          </Field>
          <Field label="Hora">
            <input
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
            />
          </Field>
        </div>

        <Field label="Comensales">
          <input
            type="number"
            min="1"
            max="50"
            required
            value={guests}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="w-32 px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
          />
        </Field>

        <Field label="Notas (opcional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
            placeholder="Mesa cerca de la ventana, silla para bebé, etc."
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-granate-800 cursor-pointer">
          <input type="checkbox" checked={sendWhatsapp} onChange={(e) => setSendWhatsapp(e.target.checked)} className="accent-granate-500" />
          Enviar confirmación por WhatsApp
        </label>

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
            disabled={submitting || !selected}
            className="px-5 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50"
          >
            {submitting ? "Creando…" : "Crear reserva"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children, col }: { label: string; children: React.ReactNode; col?: number }) {
  return (
    <label className="block" style={col ? { gridColumn: `span ${col}` } : undefined}>
      <div className="text-sm font-medium text-granate-800 mb-1">{label}</div>
      {children}
    </label>
  );
}
