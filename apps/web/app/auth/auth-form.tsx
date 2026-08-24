"use client";
import { FormEvent, useState } from "react";
import { createAuthClient } from "@/lib/auth-client";
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(null); const data = new FormData(event.currentTarget); const supabase = createAuthClient(); const email = String(data.get("email")); const password = String(data.get("password")); const result = mode === "sign-in" ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/email-verification` } }); if (result.error) setError(result.error.message); else window.location.assign(mode === "sign-in" ? "/publish" : "/auth/email-verification"); setBusy(false); }
  return <form className="custom-auth-form" onSubmit={submit}><label>Email address<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} /></label>{error && <p className="auth-form-error" role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Create account"}<span aria-hidden="true">↗</span></button></form>;
}
