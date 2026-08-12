/**
 * Auto-tagging engine.
 *
 * Rules are hardcoded here for v1 (4 rules). The system runs them after
 * every customer-affecting event (lead capture, reservation, order) AND
 * once a day via the worker to catch rule changes.
 *
 * To add a new rule: add an entry to RULES, ensure the tag exists in the
 * `tags` table (seed already creates the 4 default ones), done.
 *
 * For the client to tweak thresholds without redeploys, we'd move rules
 * to a `tag_rules` table in a v2.
 */
import { withTransaction } from "@/lib/db";
import { query } from "@/lib/db";

type CustomerSnapshot = {
  id: number;
  total_orders: number;
  total_reservations: number;
  total_spent: string;
  last_activity_at: string | null;
  created_at: string;
};

type Rule = {
  tag: string;
  description: string;
  test: (c: CustomerSnapshot) => boolean;
};

// ── Thresholds (tweak here) ────────────────────────────────────────────────
const FREQUENT_MIN_ORDERS = 3;
const VIP_MIN_SPENT_COP = 500_000; // ~$125 USD — adjust per restaurant
const INACTIVE_DAYS = 60;

const RULES: Rule[] = [
  {
    tag: "Cliente Nuevo",
    description: "Acaba de registrarse, sin órdenes ni reservas aún",
    test: (c) => c.total_orders === 0 && c.total_reservations === 0,
  },
  {
    tag: "Frecuente",
    description: `Ha hecho al menos ${FREQUENT_MIN_ORDERS} pedidos`,
    test: (c) => c.total_orders >= FREQUENT_MIN_ORDERS,
  },
  {
    tag: "VIP",
    description: `Ha gastado más de $${VIP_MIN_SPENT_COP.toLocaleString("es-CO")} COP`,
    test: (c) => Number(c.total_spent) >= VIP_MIN_SPENT_COP,
  },
  {
    tag: "Inactivo",
    description: `Sin actividad en los últimos ${INACTIVE_DAYS} días`,
    test: (c) => {
      if (c.last_activity_at) {
        const last = new Date(c.last_activity_at).getTime();
        return Date.now() - last > INACTIVE_DAYS * 24 * 60 * 60 * 1000;
      }
      // No activity recorded: count as inactive if account is older than threshold.
      const created = new Date(c.created_at).getTime();
      return Date.now() - created > INACTIVE_DAYS * 24 * 60 * 60 * 1000;
    },
  },
];

/**
 * Recalculate tags for a single customer.
 * Adds tags that match, removes tags that don't (only auto-managed ones;
 * we don't touch "manual" tags like "Reserva Cumpleaños" set by staff).
 */
export async function recalculateTagsForCustomer(customerId: number): Promise<{
  added: string[];
  removed: string[];
}> {
  const customers = await query<CustomerSnapshot[]>(
    "SELECT id, total_orders, total_reservations, total_spent, last_activity_at, created_at FROM customers WHERE id = ? LIMIT 1",
    [customerId]
  );
  const customer = customers[0];
  if (!customer) return { added: [], removed: [] };

  const autoTagNames = RULES.map((r) => r.tag);
  const matchingTags = RULES.filter((r) => r.test(customer)).map((r) => r.tag);

  return withTransaction(async (conn) => {
    // Resolve tag names to IDs
    const tagRows = (await conn.execute(
      `SELECT id, name FROM tags WHERE name IN (${autoTagNames.map(() => "?").join(",")})`,
      autoTagNames
    )) as [Array<{ id: number; name: string }>, unknown];
    const tagIdByName = new Map(tagRows[0].map((t) => [t.name, t.id]));

    // Current tags
    const currentRows = (await conn.execute(
      "SELECT tag_id FROM customer_tags WHERE customer_id = ?",
      [customerId]
    )) as [Array<{ tag_id: number }>, unknown];
    const currentTagIds = new Set(currentRows[0].map((r) => r.tag_id));
    const currentNames = new Set(
      Array.from(currentTagIds)
        .map((id) => Array.from(tagIdByName.entries()).find(([_, tid]) => tid === id)?.[0])
        .filter(Boolean) as string[]
    );

    const added: string[] = [];
    const removed: string[] = [];

    // Add missing matching tags
    for (const tag of matchingTags) {
      if (!currentNames.has(tag)) {
        const tagId = tagIdByName.get(tag);
        if (tagId) {
          await conn.execute(
            "INSERT IGNORE INTO customer_tags (customer_id, tag_id) VALUES (?, ?)",
            [customerId, tagId]
          );
          added.push(tag);
        }
      }
    }

    // Remove non-matching auto tags
    for (const tag of autoTagNames) {
      if (!matchingTags.includes(tag) && currentNames.has(tag)) {
        const tagId = tagIdByName.get(tag);
        if (tagId) {
          await conn.execute(
            "DELETE FROM customer_tags WHERE customer_id = ? AND tag_id = ?",
            [customerId, tagId]
          );
          removed.push(tag);
        }
      }
    }

    return { added, removed };
  });
}

/**
 * Recalculate tags for all customers. Used by the daily worker and
 * the "Recalcular ahora" button in settings.
 */
export async function recalculateAllTags(): Promise<{
  total: number;
  changed: number;
}> {
  const ids = await query<Array<{ id: number }>>("SELECT id FROM customers");
  let changed = 0;
  for (const { id } of ids) {
    const result = await recalculateTagsForCustomer(id);
    if (result.added.length > 0 || result.removed.length > 0) changed++;
  }
  return { total: ids.length, changed };
}
