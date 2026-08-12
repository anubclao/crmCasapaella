/**
 * Message log queries.
 */
import { query } from "@/lib/db";

export type MessageRow = {
  id: number;
  customer_id: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  direction: "outbound" | "inbound";
  channel: "whatsapp" | "sms" | "email";
  template_name: string | null;
  body: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  error: string | null;
  created_at: string;
};

export async function listMessages(opts: { limit?: number; offset?: number; status?: string; customerId?: number } = {}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    where.push("m.status = ?");
    params.push(opts.status);
  }
  if (opts.customerId) {
    where.push("m.customer_id = ?");
    params.push(opts.customerId);
  }
  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  return query<MessageRow[]>(
    `SELECT m.*, c.name AS customer_name, c.phone AS customer_phone
     FROM messages m
     LEFT JOIN customers c ON c.id = m.customer_id
     ${whereSql}
     ORDER BY m.created_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );
}
