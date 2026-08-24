"use client";

import { FormEvent, useState } from "react";

export function PublishForm({ projectId }: { projectId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const url = String(new FormData(form).get("url") || "").trim();
    if (mode === "file" && !file) return setStatus({ kind: "error", message: "Choose a .tar.gz pack to continue." });
    if (mode === "url" && !url) return setStatus({ kind: "error", message: "Enter a provider URL to continue." });
    if (!projectId) return setStatus({ kind: "error", message: "Create a project before publishing a release." });
    setBusy(true); setStatus(null);
    const body = new FormData(); body.append("projectId", projectId); body.append("kind", mode); if (file) body.append("pack", file); if (url) body.append("url", url);
    try {
      const response = await fetch("/api/publish", { method: "POST", body });
      const result = await response.json() as { message?: string; packageId?: string; version?: string };
      if (!response.ok) throw new Error(result.message || "The pack could not be published.");
      setStatus({ kind: "success", message: `${result.packageId} v${result.version} is ready in the catalog.` }); setFile(null); form.reset();
    } catch (error) { setStatus({ kind: "error", message: error instanceof Error ? error.message : "The pack could not be published." }); }
    finally { setBusy(false); }
  }

  return <form className="publish-form" onSubmit={submit}><div className="publish-form-heading"><span className="form-index">/ 01</span><h2>New release</h2><p>Publish a local file or connect a remote provider.</p></div><div className="publish-modes"><button type="button" className={mode === "file" ? "active" : ""} onClick={() => setMode("file")}>Local file</button><button type="button" className={mode === "url" ? "active" : ""} onClick={() => setMode("url")}>Remote URL</button></div>{mode === "file" ? <label className={`file-drop${file ? " has-file" : ""}`}><input type="file" accept=".tar.gz,.tgz,application/gzip" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="file-drop-mark">{file ? "✓" : "+"}</span><strong>{file ? file.name : "Choose your archive"}</strong><small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "E-compatible .tar.gz, up to 25 MB"}</small></label> : <label className="provider-url-field">Provider URL<input name="url" type="url" placeholder="https://example.com/api/knowledge" /><small>We read the public manifest. Source defaults to unknown when absent.</small></label>}<button className="button button-primary" disabled={busy} type="submit">{busy ? "Checking provider…" : "Publish release"}<span aria-hidden="true">↗</span></button>{status && <p className={`publish-status ${status.kind}`} role="status">{status.message}</p>}</form>;
}
