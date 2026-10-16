import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentRoleAsync, roleAtLeast } from "@/lib/authz";
import { CustomerImport } from "@/components/customers/CustomerImport";

export default async function ImportCustomersPage() {
  if (!roleAtLeast(await getCurrentRoleAsync(), "manager")) redirect("/customers");
  return (
    <div className="max-w-5xl">
      <Link href="/customers" className="text-sm text-granate-600 hover:underline">← Volver a clientes</Link>
      <h1 className="font-display text-3xl text-granate-800 mt-3 mb-1">Cargue masivo de clientes</h1>
      <p className="text-sm text-granate-700/60 mb-6">
        Sube un Excel (.xlsx) o CSV. Primero verás qué se va a crear, actualizar o rechazar; nada se guarda hasta que confirmes.
      </p>
      <CustomerImport />
    </div>
  );
}
