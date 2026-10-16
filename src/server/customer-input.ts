/**
 * Customer field validation, shared by the single-customer form API and the
 * bulk importer so both apply exactly the same rules.
 *
 *   Nombres, Apellidos, WhatsApp  → required
 *   Correo, Fecha de nacimiento   → optional, validated when present
 *   Estado (pipeline)             → optional, must be a known stage
 */
import { normalizePhone } from "@/lib/phone";
import { parseStage, type PipelineStage, PIPELINE_STAGES } from "@/lib/pipeline";

export type CustomerField = "firstName" | "lastName" | "phone" | "email" | "birthDate" | "stage" | "notes";

export const FIELD_LABELS: Record<CustomerField, string> = {
  firstName: "Nombres",
  lastName: "Apellidos",
  phone: "WhatsApp",
  email: "Correo",
  birthDate: "Fecha de nacimiento",
  stage: "Estado",
  notes: "Notas",
};

export type CustomerInput = {
  firstName: string;
  lastName: string;
  phone: string; // E.164
  email: string | null;
  birthDate: string | null; // YYYY-MM-DD
  stage: PipelineStage | null; // null = keep current / use default
  notes: string | null;
};

export type ValidationResult =
  | { ok: true; data: CustomerInput }
  | { ok: false; errors: Partial<Record<CustomerField, string>> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_RE = /^[\p{L}\p{M}' .-]+$/u;

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  return String(v).replace(/\s+/g, " ").trim();
}

function validName(v: string, label: string): string | null {
  if (!v) return `${label} es obligatorio`;
  if (v.length > 120) return `${label}: máximo 120 caracteres`;
  if (!NAME_RE.test(v)) return `${label}: solo letras, espacios, guion o apóstrofo`;
  return null;
}

/**
 * Accepts what people actually type or what Excel hands over:
 *   Date object · 1990-05-23 · 23/05/1990 · 23-05-1990 · 23.05.1990 · Excel serial (32651)
 * Day-first, as used in Colombia. Returns YYYY-MM-DD.
 */
export function parseBirthDate(v: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };

  let y: number, m: number, d: number;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return { ok: false, error: "Fecha de nacimiento inválida" };
    y = v.getUTCFullYear();
    m = v.getUTCMonth() + 1;
    d = v.getUTCDate();
  } else if (typeof v === "number" || /^\d{5}$/.test(text(v))) {
    // Excel serial date (days since 1899-12-30).
    const serial = Number(v);
    const dt = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    y = dt.getUTCFullYear();
    m = dt.getUTCMonth() + 1;
    d = dt.getUTCDate();
  } else {
    const s = text(v);
    let match = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (match) {
      [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
    } else {
      match = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
      if (!match) return { ok: false, error: "Fecha de nacimiento: usa el formato DD/MM/AAAA" };
      [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
    }
  }

  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return { ok: false, error: "Fecha de nacimiento: esa fecha no existe" };
  }
  const now = new Date();
  if (dt.getTime() > now.getTime()) return { ok: false, error: "Fecha de nacimiento: no puede ser futura" };
  if (y < now.getUTCFullYear() - 120) return { ok: false, error: "Fecha de nacimiento: año fuera de rango" };

  const pad = (n: number) => String(n).padStart(2, "0");
  return { ok: true, value: `${y}-${pad(m)}-${pad(d)}` };
}

export function validateCustomerInput(raw: Partial<Record<CustomerField, unknown>>): ValidationResult {
  const errors: Partial<Record<CustomerField, string>> = {};

  const firstName = text(raw.firstName);
  const lastName = text(raw.lastName);
  const fnErr = validName(firstName, "Nombres");
  if (fnErr) errors.firstName = fnErr;
  const lnErr = validName(lastName, "Apellidos");
  if (lnErr) errors.lastName = lnErr;

  let phone = "";
  const rawPhone = text(raw.phone);
  if (!rawPhone) {
    errors.phone = "WhatsApp es obligatorio";
  } else {
    const p = normalizePhone(rawPhone);
    if (!p.valid) errors.phone = `WhatsApp inválido: "${rawPhone}"`;
    else phone = p.e164;
  }

  const email = text(raw.email).toLowerCase() || null;
  if (email && (email.length > 255 || !EMAIL_RE.test(email))) errors.email = `Correo inválido: "${email}"`;

  const bd = parseBirthDate(raw.birthDate);
  if (!bd.ok) errors.birthDate = bd.error;

  let stage: PipelineStage | null = null;
  const rawStage = text(raw.stage);
  if (rawStage) {
    stage = parseStage(rawStage);
    if (!stage) {
      errors.stage = `Estado "${rawStage}" no existe. Usa: ${PIPELINE_STAGES.map((s) => s.label).join(", ")}`;
    }
  }

  const notes = raw.notes == null ? null : String(raw.notes).trim() || null;
  if (notes && notes.length > 2000) errors.notes = "Notas: máximo 2000 caracteres";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { firstName, lastName, phone, email, birthDate: bd.ok ? bd.value : null, stage, notes },
  };
}
