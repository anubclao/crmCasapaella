import { Suspense } from "react";
import { LoginForm } from "./form";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-warm-gradient" />}>
      <LoginForm />
    </Suspense>
  );
}
