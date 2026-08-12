import { z } from "zod";

/**
 * Validated environment variables.
 * Throws a clear error at boot if anything required is missing.
 *
 * In dev, this loads .env via Next.js automatically.
 * In prod (Hostinger), the prepare-deploy.mjs script loads .env.production
 * before the Next.js process starts.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 chars"),

  DATABASE_URL: z
    .string()
    .min(1)
    .refine((u) => u.startsWith("mysql://"), "DATABASE_URL must be a mysql:// URL"),

  WHATSAPP_PROVIDER: z.enum(["baileys", "meta"]).default("baileys"),
  BAILEYS_SESSION_DIR: z.string().default("./auth_artifacts/baileys"),

  META_WA_PHONE_NUMBER_ID: z.string().optional(),
  META_WA_BUSINESS_ACCOUNT_ID: z.string().optional(),
  META_WA_ACCESS_TOKEN: z.string().optional(),
  META_WA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  RESTAURANT_NAME: z.string().default("Casa Paella"),
  RESTAURANT_PHONE: z.string().default("+573138818822"),
  RESTAURANT_TIMEZONE: z.string().default("America/Bogota"),
  DEFAULT_COUNTRY_CODE: z.string().default("+57"),

  SEED_ADMIN_EMAIL: z.string().email().default("admin@casapaella.com.co"),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    // Print a readable error, not a JSON dump.
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `\n❌ Invalid environment variables:\n${issues}\n\n` +
        `Check your .env (dev) or .env.production (deploy) against .env.example.`
    );
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof envSchema>;
