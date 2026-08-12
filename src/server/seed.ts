/**
 * Seed: ensure the first admin user exists.
 * Run automatically on first server start, OR explicitly with `npm run seed`.
 *
 * On first run, prints the password once to the server log so the operator
 * can log in. CHANGE THE PASSWORD IMMEDIATELY in production.
 */
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";
import { env } from "@/lib/env";

const DEFAULT_PASSWORD = "admin1234";

export async function seedAdmin(): Promise<{ created: boolean; email: string }> {
  const email = env.SEED_ADMIN_EMAIL;
  const existing = await query<Array<{ id: number }>>("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
  if (existing.length > 0) {
    return { created: false, email };
  }
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  await query(
    "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, 'admin')",
    [email, hash, "Admin Casa Paella"]
  );
  // eslint-disable-next-line no-console
  console.log(
    `\n┌─────────────────────────────────────────────────────────────┐\n` +
      `│  ✓ Admin user created                                       │\n` +
      `│    Email:    ${email.padEnd(46)}│\n` +
      `│    Password: ${DEFAULT_PASSWORD.padEnd(46)}│\n` +
      `│    ⚠ Cambia esta contraseña en el primer login              │\n` +
      `└─────────────────────────────────────────────────────────────┘\n`
  );
  return { created: true, email };
}
