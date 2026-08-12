/**
 * Campaign sender — the core engine.
 *
 * Walks through a campaign's recipients and sends each one via the
 * configured WhatsApp provider, with a 1-msg/sec rate limit (Meta's
 * conservative safe rate for marketing templates).
 *
 * Restart safety: every send is committed to the `messages` table BEFORE
 * moving on. If the process restarts mid-campaign, the worker just
 * resumes by skipping customers that already have a `messages` row
 * for this campaign.
 *
 * Cancellation: the worker checks campaign.status === "cancelled" before
 * each send. Cheap query, lets the operator stop a runaway campaign.
 */
import { query } from "@/lib/db";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { listCustomersForCampaign } from "./customers";
import {
  getCampaign,
  incrementCampaignCounters,
  markCampaignSent,
  setCampaignRecipientsCount,
} from "./campaigns";

const RATE_LIMIT_MS = 1000; // 1 msg/sec — safe for Meta marketing templates

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
}

function varsForCustomer(c: { name: string; total_orders: number; total_spent: string }): Record<string, string> {
  return {
    nombre: c.name.split(" ")[0] ?? c.name,
    nombre_completo: c.name,
    pedidos: String(c.total_orders),
    total_gastado: new Intl.NumberFormat("es-CO").format(Number(c.total_spent)),
  };
}

/**
 * Process a single campaign. Processes up to `batchSize` messages per call.
 * The worker calls this in a loop until the campaign is done.
 *
 * Returns counts of { sent, failed, remaining, total, cancelled }.
 */
export async function processCampaign(
  campaignId: number,
  batchSize = 10
): Promise<{
  sent: number;
  failed: number;
  remaining: number;
  total: number;
  cancelled: boolean;
  skipped?: boolean;
}> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) return { sent: 0, failed: 0, remaining: 0, total: 0, cancelled: false, skipped: true };
  if (campaign.status !== "sending") return { sent: 0, failed: 0, remaining: 0, total: 0, cancelled: false, skipped: true };

  // Find which recipients have already been processed (idempotency on restart).
  const processedRows = await query<Array<{ customer_id: number }>>(
    `SELECT DISTINCT customer_id FROM messages
     WHERE campaign_id = ? AND customer_id IS NOT NULL AND status != 'failed'`,
    [campaignId]
  );
  const processedSet = new Set(processedRows.map((r) => r.customer_id));

  // Recipients per campaign spec.
  const recipients = await listCustomersForCampaign({
    type: campaign.target_type,
    value: campaign.target_value ?? undefined,
  });

  // Update total (so the UI shows it accurately even after customer changes).
  await setCampaignRecipientsCount(campaignId, recipients.length);

  // The next batch is the first `batchSize` unprocessed recipients.
  const pending = recipients.filter((r) => !processedSet.has(r.id));
  const batch = pending.slice(0, batchSize);

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batch.length; i++) {
    // Re-check campaign status each iteration so the operator can cancel.
    const fresh = await getCampaign(campaignId);
    if (!fresh || fresh.status === "cancelled") {
      return { sent, failed, remaining: pending.length - i, total: recipients.length, cancelled: true };
    }

    const customer = batch[i];
    const body = renderTemplate(campaign.message, varsForCustomer(customer));

    // 1) Log the message (queued) — this is the idempotency anchor.
    const insert = (await query(
      "INSERT INTO messages (customer_id, campaign_id, direction, channel, body, status) VALUES (?, ?, 'outbound', 'whatsapp', ?, 'queued')",
      [customer.id, campaignId, body]
    )) as { insertId: number };
    const messageId = insert.insertId;

    // 2) Send via the configured provider.
    const result = await getWhatsAppProvider().sendText({ to: customer.phone, body });

    // 3) Update message log.
    if (result.ok) {
      await query(
        "UPDATE messages SET status = 'sent', provider_message_id = ?, sent_at = NOW() WHERE id = ?",
        [result.providerMessageId, messageId]
      );
      sent++;
    } else {
      await query(
        "UPDATE messages SET status = 'failed', error = ? WHERE id = ?",
        [result.error, messageId]
      );
      failed++;
      // eslint-disable-next-line no-console
      console.error(`[campaign ${campaignId}] send failed for customer ${customer.id}: ${result.error}`);
    }

    // 4) Rate limit (skip the very last one — no point sleeping after).
    if (i < batch.length - 1) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  // 5) Update aggregate counters.
  if (sent > 0 || failed > 0) {
    await incrementCampaignCounters(campaignId, sent, failed);
  }

  const remaining = pending.length - batch.length;

  // 6) If nothing left, mark sent.
  if (remaining <= 0) {
    await markCampaignSent(campaignId);
    // eslint-disable-next-line no-console
    console.log(`[campaign ${campaignId}] ✓ done. sent=${sent}, failed=${failed}`);
  }

  return {
    sent,
    failed,
    remaining,
    total: recipients.length,
    cancelled: false,
  };
}
