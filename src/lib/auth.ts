/**
 * Auth.js v5 (next-auth@5 beta) configuration.
 *
 * Pattern: credentials provider with JWT sessions. Login form posts to
 * /api/auth/callback/credentials (a STABLE URL, not a Server Action — so it
 * survives Next.js rebuilds on Hostinger Shared).
 *
 * To add a user: either run the seed script in src/server/seed.ts, or insert
 * a row into the `users` table with a bcrypt-hashed password.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { query } from "./db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authConfig: NextAuthConfig = {
  secret: process.env.AUTH_SECRET,
  // Hostinger Shared uses LiteSpeed as a reverse proxy in front of the Node
  // process. The original Host header (e.g. crmcasapaella.tecnowebsupportia.com)
  // is preserved, but NextAuth v5 (beta) refuses to trust it by default and
  // throws "UntrustedHost". trustHost: true is the documented workaround for
  // production deployments behind a trusted reverse proxy.
  // See: https://errors.authjs.dev#untrustedhost
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const rows = (await query(
          "SELECT id, email, password_hash, name, role FROM users WHERE email = ? LIMIT 1",
          [email],
        )) as Array<{
          id: number;
          email: string;
          password_hash: string;
          name: string;
          role: string;
        }>;

        const user = rows[0];
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role?: string }).role ?? "staff";
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      if (token?.role) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
