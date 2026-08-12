"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Wrap the dashboard with NextAuth's SessionProvider so client components
 * can use useSession() / useSession-required hooks.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
