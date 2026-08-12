import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listUsers } from "@/server/users";
import { UsersClient } from "./users-client";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") {
    redirect("/dashboard");
  }
  const users = await listUsers();
  return (
    <UsersClient
      initialUsers={users}
      currentUserId={Number((session.user as { id?: string }).id ?? 0)}
    />
  );
}
