import { redirect } from "next/navigation";
import { getCurrentRoleAsync, roleAtLeast } from "@/lib/authz";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default async function NewCustomerPage() {
  if (!roleAtLeast(await getCurrentRoleAsync(), "manager")) redirect("/customers");
  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-3xl text-granate-800 mb-1">Nuevo cliente</h1>
      <p className="text-sm text-granate-700/60 mb-6">Los campos con * son obligatorios.</p>
      <CustomerForm />
    </div>
  );
}
