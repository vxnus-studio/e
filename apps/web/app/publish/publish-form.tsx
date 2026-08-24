"use client";

import { FormEvent, useState } from "react";

export function PublishForm() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) return setStatus({ kind: "error", message: "Choose a .tar.gz pack to continue." });
    setBusy(true); setStatus(null);
    const body = new FormData(); body.append("pack", file);
    try {
      const response = await fetch("/api/publish", { method: "POST", body });
      const result = await response.json() as { message?: string; packageId?: string; version?: string };
      if (!response.ok) throw new Error(result.message || "The pack could not be published.");
      setStatus({ kind: "success", message: `${result.packageId} v${result.version} is ready in the catalog.` }); setFile(null); event.currentTarget.reset();
    } catch (error) { setStatus({ kind: "error", message: error instanceof Error ? error.message : "The pack could not be published." }); }
    finally { setBusy(false); }
  }

  return <form className="publish-form" onSubmit={submit}><div className="publish-form-heading"><span className="form-index">/ 01</span><h2>Upload a pack</h2><p>One archive. The Hub handles the checks.</p></div><label className={`file-drop${file ? " has-file" : ""}`}><input type="file" accept=".tar.gz,.tgz,application/gzip" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="file-drop-mark">{file ? "✓" : "+"}</span><strong>{file ? file.name : "Choose your archive"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "E-compatible .tar.gz, up to 25 MB"}</small></label><button className="button button-primary" disabled={busy} type="submit">{busy ? "Checking pack…" : "Publish pack"}<span aria-hidden="true">↗</span></button>{status && <p className={`publish-status ${status.kind}`} role="status">{status.message}</p>}</form>;
}
