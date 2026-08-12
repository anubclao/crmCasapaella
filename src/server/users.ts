/**
 * User DB queries — read and write.
 */
import bcrypt from "bcryptjs";
import { query } from "@/lib/db";

export type UserRow = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff";
  is_active: number;
  created_at: string;
};

export async function listUsers(): Promise<UserRow[]> {
  return query<UserRow[]>(
    "SELECT id, email, name, role, is_active, created_at FROM users ORDER BY id ASC",
  );
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow[]>(
    "SELECT id, email, name, role, is_active, created_at FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

export async function getUserById(id: number): Promise<UserRow | null> {
  const rows = await query<UserRow[]>(
    "SELECT id, email, name, role, is_active, created_at FROM users WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  name: string;
  role: "admin" | "manager" | "staff";
  passwordHash: string;
}): Promise<UserRow> {
  await query(
    "INSERT INTO users (email, password_hash, name, role, is_active) VALUES (?, ?, ?, ?, 1)",
    [input.email, input.passwordHash, input.name, input.role],
  );
  const created = await getUserByEmail(input.email);
  if (!created) throw new Error("user creation failed");
  return created;
}

export async function updateUser(
  id: number,
  patch: Partial<{
    name: string;
    role: "admin" | "manager" | "staff";
    is_active: number;
  }>,
): Promise<void> {
  const fields: string[] = [];
  const values: Array<string | number> = [];
  if (patch.name !== undefined) {
    fields.push("name = ?");
    values.push(patch.name);
  }
  if (patch.role !== undefined) {
    fields.push("role = ?");
    values.push(patch.role);
  }
  if (patch.is_active !== undefined) {
    fields.push("is_active = ?");
    values.push(patch.is_active);
  }
  if (fields.length === 0) return;
  values.push(id);
  await query(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function setUserActive(
  id: number,
  active: boolean,
): Promise<void> {
  await query("UPDATE users SET is_active = ? WHERE id = ?", [
    active ? 1 : 0,
    id,
  ]);
}

export async function countActiveAdmins(): Promise<number> {
  const rows = await query<Array<{ c: number }>>(
    "SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND is_active = 1",
  );
  return rows[0]?.c ?? 0;
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

/**
 * Generate a friendly 12-char random password. URL-safe, no ambiguous chars.
 * NOT a cryptographic token — only meant to be sent over WhatsApp to a new
 * staff member who will change it on first login.
 */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
