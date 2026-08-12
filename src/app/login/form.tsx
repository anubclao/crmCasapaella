"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Login form — extracted to a client component so the page wrapper can
 * satisfy Next.js's Suspense requirement (useSearchParams in a prerendered page).
 */
export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/dashboard";

  const [csrfToken, setCsrfToken] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/csrf", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setCsrfToken(data.csrfToken))
      .catch(() =>
        setError("No se pudo cargar el formulario. Recarga la página."),
      );
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          csrfToken,
          email,
          password,
          callbackUrl,
          json: "true",
        }).toString(),
        redirect: "manual",
      });
      if (res.type === "opaqueredirect" || res.ok) {
        window.location.href = callbackUrl;
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(
        data?.error === "CredentialsSignin"
          ? "Email o contraseña incorrectos"
          : "Error de autenticación",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-warm-gradient flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-granate-500 shadow-warm-lg mb-4 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logoNew.png"
              alt="Casa Paella"
              className="w-full h-full object-cover"
            />
          </div>
          <h1 className="font-display text-4xl text-granate-700">
            Casa Paella
          </h1>
          <p className="text-granate-700/60 mt-1">CRM & Automatización</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="bg-white/80 backdrop-blur shadow-warm rounded-2xl p-8 border border-granate-100"
        >
          <h2 className="font-display text-2xl text-granate-800 mb-6">
            Iniciar sesión
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">
              {error}
            </div>
          )}

          <label className="block mb-4">
            <span className="text-sm text-granate-800 font-medium">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg border border-granate-200 bg-crema-50 focus:outline-none focus:ring-2 focus:ring-dorado-400 focus:border-transparent"
              placeholder="admin@casapaella.com.co"
            />
          </label>

          <label className="block mb-6">
            <span className="text-sm text-granate-800 font-medium">
              Contraseña
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full px-4 py-2.5 rounded-lg border border-granate-200 bg-crema-50 focus:outline-none focus:ring-2 focus:ring-dorado-400 focus:border-transparent"
            />
          </label>

          <button
            type="submit"
            disabled={loading || !csrfToken}
            className="w-full py-2.5 rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Entrando…" : "Entrar"}
          </button>

          <input type="hidden" name="csrfToken" value={csrfToken} />
        </form>

        <p className="text-center text-xs text-granate-700/50 mt-6">
          ¿Olvidaste tu contraseña? Contacta al administrador.
        </p>
      </div>
    </div>
  );
}
