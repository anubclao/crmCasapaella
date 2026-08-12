/**
 * Customer tags query helpers.
 */
import { query } from "@/lib/db";

export type TagRow = { id: number; name: string; color: string };

export async function getTagsForCustomer(customerId: number): Promise<TagRow[]> {
  return query<TagRow[]>(
    `SELECT t.id, t.name, t.color FROM tags t
     INNER JOIN customer_tags ct ON ct.tag_id = t.id
     WHERE ct.customer_id = ?
     ORDER BY t.name`,
    [customerId]
  );
}

export async function getTagsForCustomers(customerIds: number[]): Promise<Map<number, TagRow[]>> {
  if (customerIds.length === 0) return new Map();
  const rows = await query<(TagRow & { _customer_id: number })[]>(
    `SELECT t.id, t.name, t.color, ct.customer_id AS _customer_id
     FROM tags t
     INNER JOIN customer_tags ct ON ct.tag_id = t.id
     WHERE ct.customer_id IN (${customerIds.map(() => "?").join(",")})`,
    customerIds
  );
  const map = new Map<number, TagRow[]>();
  for (const r of rows) {
    const list = map.get(r._customer_id) ?? [];
    list.push({ id: r.id, name: r.name, color: r.color });
    map.set(r._customer_id, list);
  }
  return map;
}

export async function listAllTags() {
  return query<TagRow[]>("SELECT id, name, color FROM tags ORDER BY name");
}
