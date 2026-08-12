/**
 * Message template server module.
 *
 * Templates are versioned in the DB so we can iterate on copy without
 * redeploying code. For Meta Cloud, each template maps to a pre-approved
 * Meta template (the `meta_template_id` and `meta_status` fields).
 */
import { query } from "@/lib/db";
import type { MessageTemplate } from "../../drizzle/schema";

export async function getTemplate(name: string): Promise<MessageTemplate | null> {
  const rows = await query<MessageTemplate[]>(
    "SELECT * FROM message_templates WHERE name = ? AND is_active = 1 LIMIT 1",
    [name]
  );
  return rows[0] ?? null;
}

export async function listTemplates() {
  return query<MessageTemplate[]>("SELECT * FROM message_templates ORDER BY name ASC");
}

export async function createTemplate(input: {
  name: string;
  category: "transactional" | "marketing" | "utility";
  body: string;
  variables?: string[];
  language?: string;
}) {
  // Auto-extract variables from body if not provided
  const variables = input.variables ?? Array.from(new Set([...input.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])));
  const result = (await query(
    "INSERT INTO message_templates (name, category, body, variables, language) VALUES (?, ?, ?, CAST(? AS JSON), ?)",
    [input.name, input.category, input.body, JSON.stringify(variables), input.language ?? "es"]
  )) as { insertId: number };
  return result.insertId;
}

export async function updateTemplate(
  id: number,
  input: Partial<{ body: string; variables: string[]; category: string; isActive: number; metaStatus: string; metaTemplateId: string }>
) {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    const col = k.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
    fields.push(`${col} = ?`);
    values.push(v);
  }
  if (fields.length === 0) return;
  values.push(id);
  await query(`UPDATE message_templates SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function deleteTemplate(id: number) {
  await query("DELETE FROM message_templates WHERE id = ?", [id]);
}

export function renderTemplateBody(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}
