/**
 * Customer DB queries (read side).
 * Keep all SQL in this layer; pages and API routes import these helpers.
 */
import { query } from "@/lib/db";

export type CustomerRow = {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  total_reservations: number;
  total_orders: number;
  total_spent: string;
  last_activity_at: string | null;
  created_at: string;
};

export async function listCustomers(opts: {
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const search = opts.search?.trim();

  if (search) {
    const like = `%${search}%`;
    return query<CustomerRow[]>(
      `SELECT * FROM customers
       WHERE name LIKE ? OR phone LIKE ? OR email LIKE ?
       ORDER BY last_activity_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      [like, like, like]
    );
  }
  return query<CustomerRow[]>(
    `SELECT * FROM customers ORDER BY last_activity_at DESC, id DESC LIMIT ${limit} OFFSET ${offset}`
  );
}

export async function getCustomer(id: number) {
  const rows = await query<CustomerRow[]>("SELECT * FROM customers WHERE id = ? LIMIT 1", [id]);
  return rows[0] ?? null;
}

export async function countCustomers() {
  const rows = await query<Array<{ c: number }>>("SELECT COUNT(*) AS c FROM customers");
  return rows[0]?.c ?? 0;
}

export async function listCustomersForCampaign(target: {
  type: "all" | "tag" | "inactive_days";
  value?: string;
}) {
  if (target.type === "all") {
    return query<CustomerRow[]>(
      "SELECT * FROM customers WHERE phone IS NOT NULL AND phone != ''"
    );
  }
  if (target.type === "tag" && target.value) {
    return query<CustomerRow[]>(
      `SELECT c.* FROM customers c
       INNER JOIN customer_tags ct ON ct.customer_id = c.id
       INNER JOIN tags t ON t.id = ct.tag_id
       WHERE t.name = ? AND c.phone IS NOT NULL`,
      [target.value]
    );
  }
  if (target.type === "inactive_days" && target.value) {
    const days = Number(target.value);
    if (!Number.isFinite(days) || days <= 0) return [];
    return query<CustomerRow[]>(
      `SELECT * FROM customers
       WHERE phone IS NOT NULL AND phone != ''
         AND (last_activity_at IS NULL OR last_activity_at < (NOW() - INTERVAL ? DAY))`,
      [days]
    );
  }
  return [];
}
