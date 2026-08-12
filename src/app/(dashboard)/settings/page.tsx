"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { data: session, update } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tagBusy, setTagBusy] = useState(false);
  const [tagMsg, setTagMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (next !== confirm) {
      setError("La confirmación no coincide");
      return;
    }
    if (next.length < 8) {
      setError("Mínimo 8 caracteres");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error al cambiar");
        return;
      }
      setSuccess(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      await update();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  async function recalcTags() {
    setTagBusy(true);
    setTagMsg(null);
    try {
      const res = await fetch("/api/customers/recalculate-tags", { method: "POST", credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setTagMsg(`✗ ${data.error ?? "Error"}`);
        return;
      }
      setTagMsg(`✓ ${data.changed} de ${data.total} clientes actualizados.`);
    } catch (e) {
      setTagMsg(`✗ ${e instanceof Error ? e.message : "Error de red"}`);
    } finally {
      setTagBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <h1 className="font-display text-3xl text-granate-800 mb-1">Configuración</h1>
        <p className="text-sm text-granate-700/60">Sesión iniciada como {session?.user?.email}</p>
      </div>

      {/* Change password */}
      <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-4">
        <h2 className="font-display text-xl text-granate-800">Cambiar contraseña</h2>

        {error && <div className="p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">{error}</div>}
        {success && <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">✓ Contraseña actualizada.</div>}

        <Field label="Contraseña actual">
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Nueva contraseña">
          <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} minLength={8} />
        </Field>
        <Field label="Confirmar">
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} minLength={8} />
        </Field>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-sm text-granate-700 hover:underline"
          >
            Cerrar sesión
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-5 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>

      {/* Auto-tagging */}
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-4">
        <div>
          <h2 className="font-display text-xl text-granate-800">Etiquetas automáticas</h2>
          <p className="text-sm text-granate-700/60 mt-1">
            El sistema recalcula las etiquetas (Frecuente, VIP, Inactivo, Cliente Nuevo) cada noche a las 3am. Si querés forzar el recálculo ahora:
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={recalcTags}
            disabled={tagBusy}
            className="px-4 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50"
          >
            {tagBusy ? "Recalculando…" : "Recalcular ahora"}
          </button>
          {tagMsg && <span className="text-sm text-granate-700">{tagMsg}</span>}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-granate-800 mb-1">{label}</div>
      {children}
    </label>
  );
}
