"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PIPELINE_STAGES, DEFAULT_STAGE } from "@/lib/pipeline";

export type CustomerFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string; // YYYY-MM-DD or ""
  stage: string;
  notes: string;
};

type FieldErrors = Partial<Record<keyof CustomerFormValues, string>>;

const EMPTY: CustomerFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  birthDate: "",
  stage: DEFAULT_STAGE,
  notes: "",
};

const inputCls = (err?: string) =>
  `w-full px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-dorado-400 ${
    err ? "border-granate-500" : "border-granate-200"
  }`;

export function CustomerForm({ customerId, initial }: { customerId?: number; initial?: Partial<CustomerFormValues> }) {
  const router = useRouter();
  const [values, setValues] = useState<CustomerFormValues>({ ...EMPTY, ...initial });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const editing = customerId !== undefined;
  const today = new Date().toISOString().slice(0, 10);

  const set = (k: keyof CustomerFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [k]: e.target.value }));
    setFieldErrors((fe) => ({ ...fe, [k]: undefined }));
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExistingId(null);
    setSubmitting(true);
    try {
      const res = await fetch(editing ? `/api/customers/${customerId}` : "/api/customers", {
        method: editing ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "No se pudo guardar");
        setFieldErrors(data.fieldErrors ?? {});
        setExistingId(data.existingId ?? null);
        return;
      }
      router.push(`/customers/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">
          {error}
          {existingId && (
            <>
              {" · "}
              <Link href={`/customers/${existingId}`} className="underline font-medium">
                Ver cliente
              </Link>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nombres *" error={fieldErrors.firstName}>
          <input value={values.firstName} onChange={set("firstName")} autoComplete="given-name" required maxLength={120} className={inputCls(fieldErrors.firstName)} />
        </Field>
        <Field label="Apellidos *" error={fieldErrors.lastName}>
          <input value={values.lastName} onChange={set("lastName")} autoComplete="family-name" required maxLength={120} className={inputCls(fieldErrors.lastName)} />
        </Field>
        <Field label="WhatsApp *" error={fieldErrors.phone} hint="Celular de 10 dígitos o con indicativo (+57…)">
          <input value={values.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel" required placeholder="300 123 4567" className={inputCls(fieldErrors.phone)} />
        </Field>
        <Field label="Correo" error={fieldErrors.email}>
          <input value={values.email} onChange={set("email")} type="email" autoComplete="email" placeholder="nombre@correo.com" className={inputCls(fieldErrors.email)} />
        </Field>
        <Field label="Fecha de nacimiento" error={fieldErrors.birthDate}>
          <input value={values.birthDate} onChange={set("birthDate")} type="date" max={today} className={inputCls(fieldErrors.birthDate)} />
        </Field>
        <Field label="Estado en el pipeline" error={fieldErrors.stage}>
          <select value={values.stage} onChange={set("stage")} className={inputCls(fieldErrors.stage)}>
            {PIPELINE_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Notas" error={fieldErrors.notes}>
        <textarea value={values.notes} onChange={set("notes")} rows={3} maxLength={2000} className={inputCls(fieldErrors.notes)} placeholder="Preferencias, alergias, ocasión especial…" />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-granate-50">
          Cancelar
        </button>
        <button type="submit" disabled={submitting} className="px-5 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50">
          {submitting ? "Guardando…" : editing ? "Guardar cambios" : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-granate-800 mb-1">{label}</div>
      {children}
      {error ? (
        <div className="mt-1 text-xs text-granate-600">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-xs text-granate-700/50">{hint}</div>
      ) : null}
    </label>
  );
}
