/**
 * Campaign DB queries (read + write).
 * Keep all SQL in this layer; pages and API routes import these helpers.
 */
import { query, withTransaction } from "@/lib/db";

export type CampaignRow = {
  id: number;
  title: string;
  message: string;
  target_type: "all" | "tag" | "inactive_days";
  target_value: string | null;
  template_name: string | null;
  status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
  scheduled_at: string | null;
  sent_at: string | null;
  recipients_count: number;
  delivered_count: number;
  failed_count: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateCampaignInput = {
  title: string;
  message: string;
  targetType: "all" | "tag" | "inactive_days";
  targetValue?: string;
  templateName?: string;
  scheduledAt?: Date;
  createdBy: number;
};

export async function createCampaign(input: CreateCampaignInput) {
  const status = input.scheduledAt ? "scheduled" : "draft";
  const result = (await query(
    `INSERT INTO campaigns
      (title, message, target_type, target_value, template_name, status, scheduled_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.title,
      input.message,
      input.targetType,
      input.targetValue ?? null,
      input.templateName ?? null,
      status,
      input.scheduledAt ?? null,
      input.createdBy,
    ]
  )) as { insertId: number };
  return result.insertId;
}

export async function listCampaigns() {
  return query<CampaignRow[]>("SELECT * FROM campaigns ORDER BY created_at DESC LIMIT 100");
}

export async function getCampaign(id: number) {
  const rows = await query<CampaignRow[]>("SELECT * FROM campaigns WHERE id = ? LIMIT 1", [id]);
  return rows[0] ?? null;
}

export async function setCampaignStatus(id: number, status: CampaignRow["status"]) {
  await query("UPDATE campaigns SET status = ? WHERE id = ?", [status, id]);
}

export async function setCampaignRecipientsCount(id: number, count: number) {
  await query("UPDATE campaigns SET recipients_count = ? WHERE id = ?", [count, id]);
}

export async function incrementCampaignCounters(id: number, delivered: number, failed: number) {
  if (delivered === 0 && failed === 0) return;
  await query(
    "UPDATE campaigns SET delivered_count = delivered_count + ?, failed_count = failed_count + ? WHERE id = ?",
    [delivered, failed, id]
  );
}

export async function markCampaignSent(id: number) {
  await query("UPDATE campaigns SET status = 'sent', sent_at = NOW() WHERE id = ?", [id]);
}

export async function countCampaignMessages(campaignId: number) {
  const rows = await query<Array<{ total: number; sent: number; failed: number }>>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status IN ('sent','delivered','read') THEN 1 ELSE 0 END) AS sent,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM messages WHERE campaign_id = ?`,
    [campaignId]
  );
  return rows[0] ?? { total: 0, sent: 0, failed: 0 };
}

export async function listCampaignMessages(campaignId: number, limit = 50) {
  return query<
    Array<{
      id: number;
      customer_id: number;
      customer_name: string;
      customer_phone: string;
      body: string;
      status: string;
      error: string | null;
      created_at: string;
    }>
  >(
    `SELECT m.id, m.customer_id, c.name AS customer_name, c.phone AS customer_phone,
            m.body, m.status, m.error, m.created_at
     FROM messages m
     LEFT JOIN customers c ON c.id = m.customer_id
     WHERE m.campaign_id = ?
     ORDER BY m.created_at DESC
     LIMIT ?`,
    [campaignId, limit]
  );
}

/**
 * Count how many customers would be targeted by the given audience spec.
 * Cheap query — used to populate the "X recipients" preview in the UI.
 */
export async function countAudience(target: {
  type: "all" | "tag" | "inactive_days";
  value?: string;
}): Promise<number> {
  if (target.type === "all") {
    const rows = await query<Array<{ c: number }>>(
      "SELECT COUNT(*) AS c FROM customers WHERE phone IS NOT NULL AND phone != ''"
    );
    return rows[0]?.c ?? 0;
  }
  if (target.type === "tag" && target.value) {
    const rows = await query<Array<{ c: number }>>(
      `SELECT COUNT(*) AS c FROM customers c
       INNER JOIN customer_tags ct ON ct.customer_id = c.id
       INNER JOIN tags t ON t.id = ct.tag_id
       WHERE t.name = ? AND c.phone IS NOT NULL`,
      [target.value]
    );
    return rows[0]?.c ?? 0;
  }
  if (target.type === "inactive_days" && target.value) {
    const days = Number(target.value);
    if (!Number.isFinite(days) || days <= 0) return 0;
    const rows = await query<Array<{ c: number }>>(
      `SELECT COUNT(*) AS c FROM customers
       WHERE phone IS NOT NULL AND phone != ''
         AND (last_activity_at IS NULL OR last_activity_at < (NOW() - INTERVAL ? DAY))`,
      [days]
    );
    return rows[0]?.c ?? 0;
  }
  return 0;
}
