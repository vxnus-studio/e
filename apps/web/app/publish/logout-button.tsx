"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createAuthClient } from "@/lib/auth-client";

export function LogoutButton() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  async function logout() {
    setBusy(true);
    await createAuthClient().auth.signOut();
    router.push("/");
  }
  return <button className="sidebar-logout" disabled={busy} onClick={logout}>{busy ? "Signing out…" : "Log out"}</button>;
}
