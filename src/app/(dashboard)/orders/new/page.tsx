"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Customer = { id: number; name: string; phone: string; email: string | null };
type Item = { name: string; qty: number; price: number };

const QUICK_ITEMS = [
  { name: "Paella Valenciana", price: 42000 },
  { name: "Paella Mixta", price: 48000 },
  { name: "Paella de Mariscos", price: 52000 },
  { name: "Tortilla Española", price: 24000 },
  { name: "Croquetas (6 uds)", price: 22000 },
  { name: "Sangría (jarra)", price: 28000 },
  { name: "Gazpacho", price: 18000 },
  { name: "Patatas Bravas", price: 16000 },
];

export default function NewOrderPage() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [orderType, setOrderType] = useState<"delivery" | "pickup" | "dine_in">("delivery");
  const [items, setItems] = useState<Item[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  function addItem(template: { name: string; price: number }) {
    setItems((prev) => {
      const existing = prev.find((i) => i.name === template.name);
      if (existing) {
        return prev.map((i) => (i.name === template.name ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...prev, { name: template.name, qty: 1, price: template.price }];
    });
  }

  function removeItem(name: string) {
    setItems((prev) => prev.filter((i) => i.name !== name));
  }

  function updateQty(name: string, qty: number) {
    if (qty <= 0) {
      removeItem(name);
      return;
    }
    setItems((prev) => prev.map((i) => (i.name === name ? { ...i, qty } : i)));
  }

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  const fmtCOP = (n: number) => new Intl.NumberFormat("es-CO").format(n);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Selecciona un cliente");
      return;
    }
    if (items.length === 0) {
      setError("Agrega al menos un item");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: selected.id,
          orderType,
          items,
          totalAmount: total,
          deliveryAddress: orderType === "delivery" ? deliveryAddress : undefined,
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
    <div className="max-w-3xl">
      <h1 className="font-display text-3xl text-granate-800 mb-1">Nuevo pedido</h1>
      <p className="text-sm text-granate-700/60 mb-6">Crea un pedido manual (teléfono, walk-in)</p>

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
                      <div className="text-xs text-granate-700/70">{c.phone}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </Field>

        <Field label="Tipo">
          <div className="flex gap-2">
            {(["delivery", "pickup", "dine_in"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className={`px-4 py-2 text-sm rounded-lg border ${
                  orderType === t
                    ? "bg-granate-500 text-white border-granate-500"
                    : "border-granate-200 text-granate-700 hover:bg-crema-50"
                }`}
              >
                {t === "delivery" ? "🛵 Domicilio" : t === "pickup" ? "🛍️ Recoger" : "🍽️ En local"}
              </button>
            ))}
          </div>
        </Field>

        {orderType === "delivery" && (
          <Field label="Dirección de entrega">
            <input
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
              placeholder="Calle 100 #15-20, Bogotá"
            />
          </Field>
        )}

        <Field label="Items">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {QUICK_ITEMS.map((it) => (
              <button
                key={it.name}
                type="button"
                onClick={() => addItem(it)}
                className="text-left p-2 rounded-lg border border-granate-200 hover:border-granate-400 hover:bg-crema-50 text-xs"
              >
                <div className="font-medium text-granate-800">{it.name}</div>
                <div className="text-granate-700/70">${fmtCOP(it.price)}</div>
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-granate-700/50 italic">Toca un item de arriba para agregarlo.</p>
          ) : (
            <div className="border border-granate-200 rounded-lg divide-y divide-granate-100">
              {items.map((i) => (
                <div key={i.name} className="flex items-center justify-between p-2.5 text-sm">
                  <span className="text-granate-800 flex-1">{i.name}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => updateQty(i.name, i.qty - 1)} className="w-6 h-6 rounded border border-granate-200 text-granate-700">−</button>
                    <span className="w-6 text-center text-granate-800">{i.qty}</span>
                    <button type="button" onClick={() => updateQty(i.name, i.qty + 1)} className="w-6 h-6 rounded border border-granate-200 text-granate-700">+</button>
                    <span className="w-24 text-right text-granate-800">${fmtCOP(i.qty * i.price)}</span>
                    <button type="button" onClick={() => removeItem(i.name)} className="text-granate-500 hover:text-granate-700 ml-2">×</button>
                  </div>
                </div>
              ))}
              <div className="p-2.5 bg-crema-50 flex justify-between font-medium">
                <span className="text-granate-800">Total</span>
                <span className="text-granate-800">${fmtCOP(total)} COP</span>
              </div>
            </div>
          )}
        </Field>

        <Field label="Notas (opcional)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400"
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
            disabled={submitting || !selected || items.length === 0}
            className="px-5 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50"
          >
            {submitting ? "Creando…" : `Crear pedido · $${fmtCOP(total)}`}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-granate-800 mb-1">{label}</div>
      {children}
    </label>
  );
}
