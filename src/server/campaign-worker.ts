/**
 * Campaign worker — runs every 30s.
 *
 *   1. Promotes `scheduled` campaigns whose scheduled_at <= now → `sending`.
 *   2. Picks up all `sending` campaigns and processes the next batch.
 *
 * Started once from `src/instrumentation.ts`. Singleton across Next.js dev
 * hot-reload via globalThis.
 *
 * Throughput: 10 messages per tick × 2 ticks/min ≈ 20 msg/min.
 * A 500-recipient campaign finishes in ~25 minutes — fine for restaurant-scale
 * marketing. For higher throughput, raise BATCH_SIZE below.
 */
import { query } from "@/lib/db";
import { processCampaign } from "./campaign-sender";
import { recalculateAllTags } from "./auto-tagging";
import cron from "node-cron";

const BATCH_SIZE = 10;
const CRON_EXPR = "*/30 * * * * *"; // every 30 seconds
const TAG_REFRESH_CRON = "0 3 * * *"; // daily at 3am (server TZ)

const globalForWorker = globalThis as unknown as {
  __campaignWorker?: { task: cron.ScheduledTask | null; tagTask: cron.ScheduledTask | null };
};

async function tick() {
  try {
    // 1) Promote scheduled → sending.
    const promoted = (await query(
      "UPDATE campaigns SET status = 'sending' WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= NOW()"
    )) as { affectedRows: number };
    if (promoted.affectedRows > 0) {
      // eslint-disable-next-line no-console
      console.log(`[campaign-worker] promoted ${promoted.affectedRows} scheduled campaign(s) to sending`);
    }

    // 2) Find all sending campaigns.
    const sending = await query<Array<{ id: number; title: string; recipients_count: number }>>(
      "SELECT id, title, recipients_count FROM campaigns WHERE status = 'sending' ORDER BY id ASC"
    );

    for (const c of sending) {
      const result = await processCampaign(c.id, BATCH_SIZE);
      if (result.sent > 0 || result.failed > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[campaign-worker] #${c.id} "${c.title}" — sent=${result.sent} failed=${result.failed} remaining=${result.remaining}/${result.total}`
        );
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[campaign-worker] tick failed:", err instanceof Error ? err.message : err);
  }
}

export function startCampaignWorker() {
  if (globalForWorker.__campaignWorker) {
    // eslint-disable-next-line no-console
    console.log("[campaign-worker] already running");
    return;
  }

  // eslint-disable-next-line no-console
  console.log("[campaign-worker] starting (every 30s, batch=10)");
  const task = cron.schedule(CRON_EXPR, tick, { scheduled: true });

  // Daily auto-tag refresher
  // eslint-disable-next-line no-console
  console.log("[tag-refresher] scheduled (daily at 3am)");
  const tagTask = cron.schedule(TAG_REFRESH_CRON, async () => {
    // eslint-disable-next-line no-console
    console.log("[tag-refresher] running daily refresh…");
    try {
      const result = await recalculateAllTags();
      // eslint-disable-next-line no-console
      console.log(`[tag-refresher] ✓ ${result.changed}/${result.total} customers updated`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[tag-refresher] failed:", e);
    }
  }, { scheduled: true });

  globalForWorker.__campaignWorker = { task, tagTask };

  // Also fire once shortly after boot to catch any scheduled campaigns
  // whose scheduled_at already passed (e.g. server was down).
  setTimeout(tick, 5000);
}

export function stopCampaignWorker() {
  const w = globalForWorker.__campaignWorker;
  if (w?.task) w.task.stop();
  if (w?.tagTask) w.tagTask.stop();
  globalForWorker.__campaignWorker = { task: null, tagTask: null };
  // eslint-disable-next-line no-console
  console.log("[campaign-worker] stopped");
}
