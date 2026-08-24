"use client";
import { useState } from "react";

export function ClaimTeyvat({ projectId, claimed }: { projectId?: string; claimed: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!projectId || claimed) return null;
  async function claim() {
    setBusy(true); setMessage(null);
    const response = await fetch("/api/publish/teyvat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) setMessage(result.message || "E-Teyvat could not be claimed."); else window.location.reload();
    setBusy(false);
  }
  return <div className="claim-teyvat"><div><strong>First-party provider</strong><p>Attach the live E-Teyvat provider to your vxnuslabs project.</p></div><button className="button button-dark" disabled={busy} onClick={claim}>{busy ? "Verifying…" : "Claim E-Teyvat"}<span>↗</span></button>{message && <p className="creator-error">{message}</p>}</div>;
}
