/**
 * GET  /api/webhook/whatsapp — Meta webhook verification challenge.
 * POST /api/webhook/whatsapp — Meta inbound messages + status updates.
 *
 * Meta's Cloud API sends two kinds of payloads:
 *   1. Status updates for messages WE sent (sent, delivered, read, failed)
 *   2. Inbound messages from customers (when they reply)
 *
 * For #1: we update the corresponding row in `messages` by provider_message_id.
 * For #2: for now we just log. A future phase could route inbound messages
 *         to staff as notifications.
 *
 * Only used when WHATSAPP_PROVIDER=meta. With Baileys, the same events
 * come through the Baileys socket, not this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === env.META_WA_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ ok: false }, { status: 403 });
}

type MetaStatusPayload = {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        statuses?: Array<{
          id: string; // wamid.* — the message ID we sent
          status: "sent" | "delivered" | "read" | "failed";
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string; message?: string }>;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
      field?: string;
    }>;
  }>;
};

export async function POST(req: NextRequest) {
  // Acknowledge immediately, then process.
  let payload: MetaStatusPayload;
  try {
    payload = (await req.json()) as MetaStatusPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value) continue;

        // Status updates
        for (const status of value.statuses ?? []) {
          await applyStatusUpdate(status);
        }

        // Inbound messages
        for (const msg of value.messages ?? []) {
          // eslint-disable-next-line no-console
          console.log(`[whatsapp-inbound] from=${msg.from} type=${msg.type} text=${msg.text?.body?.slice(0, 200)}`);
        }
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[whatsapp-webhook] processing error:", e);
  }

  return NextResponse.json({ ok: true });
}

async function applyStatusUpdate(status: {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  errors?: Array<{ code: number; title: string; message?: string }>;
}) {
  const ts = new Date(Number(status.timestamp) * 1000);
  const errorText = status.errors?.map((e) => `${e.title}${e.message ? `: ${e.message}` : ""}`).join("; ") ?? null;

  if (status.status === "delivered") {
    await query(
      "UPDATE messages SET status = 'delivered', delivered_at = ? WHERE provider_message_id = ? AND status IN ('queued', 'sent')",
      [ts, status.id]
    );
  } else if (status.status === "read") {
    await query(
      "UPDATE messages SET status = 'read' WHERE provider_message_id = ? AND status IN ('queued', 'sent', 'delivered')",
      [status.id]
    );
  } else if (status.status === "sent") {
    // Just confirms Meta accepted it.
    await query(
      "UPDATE messages SET status = 'sent', sent_at = ? WHERE provider_message_id = ? AND status = 'queued'",
      [ts, status.id]
    );
  } else if (status.status === "failed") {
    await query(
      "UPDATE messages SET status = 'failed', error = ? WHERE provider_message_id = ?",
      [errorText ?? "Meta rejected the message", status.id]
    );
    // eslint-disable-next-line no-console
    console.error(`[whatsapp-webhook] message ${status.id} failed: ${errorText}`);
  }
}
