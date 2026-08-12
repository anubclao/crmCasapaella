import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { Providers } from "@/components/Providers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = ((session.user as { role?: string }).role ?? "staff") as
    | "admin"
    | "manager"
    | "staff";
  return (
    <Providers>
      <div className="flex min-h-screen bg-crema-100">
        <Sidebar role={role} />
        <div className="flex-1 flex flex-col">
          <Topbar
            userName={session.user.name}
            userEmail={session.user.email ?? undefined}
          />
          <main className="flex-1 p-8">{children}</main>
        </div>
      </div>
    </Providers>
  );
}
