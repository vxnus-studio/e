"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ProjectSettingsProps = { project: { id: string; name: string; description: string | null; visibility: "private" | "public"; publisher: string; created_at: string; updated_at: string }; releaseCount: number };
function projectSlug(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function formatDate(value: string) { return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export function ProjectSettings({ project, releaseCount }: ProjectSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [visibility, setVisibility] = useState(project.visibility);
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setStatus(null);
    try { const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description, visibility }) }); const result = await response.json() as { message?: string }; if (!response.ok) throw new Error(result.message || "Project could not be updated."); setStatus({ kind: "success", message: "Project settings saved." }); if (name !== project.name) router.push(`/publish/${projectSlug(name)}/release`); }
    catch (error) { setStatus({ kind: "error", message: error instanceof Error ? error.message : "Project could not be updated." }); } finally { setBusy(false); }
  }
  async function remove() {
    if (!window.confirm(`Delete ${project.name}? This removes the project and its published registry releases.`)) return;
    setBusy(true); setStatus(null);
    try { const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" }); const result = await response.json() as { message?: string }; if (!response.ok) throw new Error(result.message || "Project could not be deleted."); router.push("/publish/projects"); }
    catch (error) { setStatus({ kind: "error", message: error instanceof Error ? error.message : "Project could not be deleted." }); setBusy(false); }
  }
  return <section className="project-settings" aria-labelledby="project-settings-title"><div className="settings-heading"><div><span className="dashboard-kicker">Project controls</span><h2 id="project-settings-title">Settings</h2></div><span className={`visibility ${visibility}`}>{visibility}</span></div><div className="settings-grid"><form className="settings-form" onSubmit={save}><label>Project name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="What does this project make knowable?" /></label><label>Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "public")}><option value="private">Private — only you and members</option><option value="public">Public — visible in the catalog</option></select></label><button className="button button-dark" disabled={busy} type="submit">{busy ? "Saving…" : "Save settings"}</button>{status && <p className={`settings-status ${status.kind}`} role="status">{status.message}</p>}</form><aside className="settings-metadata"><span className="dashboard-kicker">Metadata</span><dl><div><dt>Publisher</dt><dd>@{project.publisher}</dd></div><div><dt>Project ID</dt><dd><code>{project.id}</code></dd></div><div><dt>Releases</dt><dd>{releaseCount}</dd></div><div><dt>Created</dt><dd>{formatDate(project.created_at)}</dd></div><div><dt>Last updated</dt><dd>{formatDate(project.updated_at)}</dd></div></dl></aside></div><div className="danger-zone"><div><span className="dashboard-kicker">Danger zone</span><h3>Delete this project</h3><p>Removes the project, its release history, and registry entries. This cannot be undone.</p></div><button className="button button-danger" disabled={busy} onClick={remove} type="button">Delete project</button></div></section>;
}
