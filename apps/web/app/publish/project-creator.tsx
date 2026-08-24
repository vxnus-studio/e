"use client";
import { FormEvent, useState } from "react";
export function ProjectCreator() {
  const [open, setOpen] = useState(false); const [message, setMessage] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(null); const data = new FormData(event.currentTarget); const response = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) }); const result = await response.json() as { message?: string }; if (!response.ok) setMessage(result.message || "Project could not be created."); else window.location.reload(); setBusy(false); }
  if (!open) return <button className="button button-dark create-project-button" onClick={() => setOpen(true)}>New project <span>+</span></button>;
  return <form className="project-creator" onSubmit={submit}><label>Publisher ID<input name="publisher" required placeholder="acme-knowledge" /></label><label>Project name<input name="name" required placeholder="A public name" /></label><label className="creator-wide">Description<input name="description" placeholder="What does this project make knowable?" /></label>{message && <p className="creator-error">{message}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create project"}</button></form>;
}
