/**
 * Baileys WhatsApp provider — for development and MVP.
 *
 * Uses @whiskeysockets/baileys (the maintained fork of the original Baileys).
 * Connects via QR scan: the first time, visit /whatsapp in the dashboard,
 * scan the QR with the business phone's WhatsApp, and the session is
 * persisted in ./auth_artifacts/baileys/. Subsequent restarts reuse it.
 *
 * Caveat: against Meta ToS for production scale. Meta can ban the number
 * without notice. Use this for the MVP and switch to meta.ts once the
 * WhatsApp Business account is approved.
 */
import { existsSync, mkdirSync } from "node:fs";
import { env } from "../env";
import type {
  WhatsAppProvider,
  SendTextInput,
  SendTemplateInput,
  SendResult,
  ConnectionStatus,
} from "./types";

// Lazy require to keep cold-start fast and avoid loading the WS lib in prod
// when WHATSAPP_PROVIDER=meta.
type BaileysModule = typeof import("@whiskeysockets/baileys");
type WASocket = Awaited<ReturnType<BaileysModule["default"]>>;

type BaileysState = {
  sock: WASocket | null;
  qr: string | null;
  connectedPhone: string | null;
  initPromise: Promise<void> | null;
};

// Survive Next.js dev hot-reload.
const globalForBaileys = globalThis as unknown as { __baileys?: BaileysState };

function getState(): BaileysState {
  if (!globalForBaileys.__baileys) {
    globalForBaileys.__baileys = { sock: null, qr: null, connectedPhone: null, initPromise: null };
  }
  return globalForBaileys.__baileys;
}

function jidFromPhone(phone: string): string {
  // Baileys wants "<digits>@s.whatsapp.net"
  const digits = phone.replace(/\D/g, "");
  return `${digits}@s.whatsapp.net`;
}

export class BaileysProvider implements WhatsAppProvider {
  async init(): Promise<void> {
    const state = getState();
    if (state.sock || state.initPromise) return state.initPromise ?? Promise.resolve();

    state.initPromise = (async () => {
      const bailey = await import("@whiskeysockets/baileys");
      const { state: authState, saveCreds } = await bailey.useMultiFileAuthState(
        env.BAILEYS_SESSION_DIR
      );
      if (!existsSync(env.BAILEYS_SESSION_DIR)) {
        mkdirSync(env.BAILEYS_SESSION_DIR, { recursive: true });
      }

      const sock = bailey.default({
        auth: authState,
        printQRInTerminal: false, // we expose the QR via the API
        browser: bailey.Browsers.macOS("Desktop"),
        generateHighQualityLinkPreview: true,
      });

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", (update) => {
        const s = getState();
        const { connection, qr, lastDisconnect } = update;
        if (qr) {
          s.qr = qr;
          // eslint-disable-next-line no-console
          console.log("[baileys] new QR code available — open /whatsapp in the dashboard");
        }
        if (connection === "open") {
          s.qr = null;
          s.connectedPhone = sock.user?.id?.split(":")[0] ?? null;
          // eslint-disable-next-line no-console
          console.log(`[baileys] connected as +${s.connectedPhone}`);
        }
        if (connection === "close") {
          const reason = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
            ?.output?.statusCode;
          const shouldReconnect = reason !== bailey.DisconnectReason.loggedOut;
          s.sock = null;
          // eslint-disable-next-line no-console
          console.log(`[baileys] disconnected (reason=${reason}, reconnect=${shouldReconnect})`);
          if (shouldReconnect) {
            s.initPromise = null;
            this.init().catch((e) => console.error("[baileys] reconnect failed", e));
          }
        }
      });

      state.sock = sock;
    })();

    return state.initPromise;
  }

  async sendText({ to, body }: SendTextInput): Promise<SendResult> {
    await this.init();
    const sock = getState().sock;
    if (!sock) {
      return { ok: false, error: "Baileys socket not connected. Scan the QR at /whatsapp." };
    }
    try {
      const jid = jidFromPhone(to);
      const result = await sock.sendMessage(jid, { text: body });
      return {
        ok: true,
        providerMessageId: result?.key?.id ?? `baileys-${Date.now()}`,
        status: "sent",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendTemplate({ to, templateName, languageCode = "es" }: SendTemplateInput): Promise<SendResult> {
    // Baileys doesn't use Meta-style templates (they're an API concept).
    // For dev, we send a text message that emulates the template content.
    // The template body is read from the campaign/message log by the caller,
    // so we just pass through the body if provided via the wrapper.
    return this.sendText({
      to,
      body: `[template:${templateName}/${languageCode}] (Baileys dev — no real template engine)`,
    });
  }

  async getStatus(): Promise<ConnectionStatus> {
    const s = getState();
    return {
      provider: "baileys",
      connected: !!s.sock && !!s.connectedPhone,
      qrCode: s.qr,
      phoneNumber: s.connectedPhone ? `+${s.connectedPhone}` : null,
    };
  }

  async disconnect(): Promise<void> {
    const s = getState();
    if (s.sock) {
      try {
        await s.sock.logout();
      } catch {
        /* ignore */
      }
      s.sock = null;
    }
    s.qr = null;
    s.connectedPhone = null;
    s.initPromise = null;
  }
}
