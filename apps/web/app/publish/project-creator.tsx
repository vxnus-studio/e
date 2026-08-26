"use client";

import { FormEvent, useState } from "react";
import type { KnowledgePackManifest } from "@vxnus/e";

const LICENSE_PRESETS: Record<string, { name: string; url: string }> = {
  "CC-BY-4.0": { name: "Creative Commons Attribution 4.0 International", url: "https://creativecommons.org/licenses/by/4.0/" },
  "MIT": { name: "MIT License", url: "https://opensource.org/licenses/MIT" },
  "Apache-2.0": { name: "Apache License 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  "CC0-1.0": { name: "Creative Commons Zero v1.0 Universal", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "Proprietary": { name: "Proprietary / All Rights Reserved", url: "" },
};

export function ProjectCreator() {
  const [open, setOpen] = useState(false);
  const [showManifestFields, setShowManifestFields] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Manifest form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [licenseKey, setLicenseKey] = useState("CC-BY-4.0");
  const [rightsHolder, setRightsHolder] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUri, setSourceUri] = useState("");
  const [capabilities, setCapabilities] = useState({
    structuredEntities: true,
    relations: true,
    revisions: true,
    lexicalSearch: false,
    semanticSearch: false,
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const preset = LICENSE_PRESETS[licenseKey] || { name: licenseKey, url: "" };
    const manifest: Partial<KnowledgePackManifest> = {
      description: description.trim() || undefined,
      license: {
        license: licenseKey,
        licenseName: preset.name,
        licenseUrl: preset.url || "https://choosealicense.com/",
        rightsHolder: rightsHolder.trim() || undefined,
        copyrightNotice: rightsHolder.trim() ? `© ${new Date().getFullYear()} ${rightsHolder.trim()}` : undefined,
      },
      sources: sourceTitle.trim()
        ? [{
            id: sourceTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "primary-source",
            title: sourceTitle.trim(),
            license: licenseKey,
            licenseUrl: preset.url || undefined,
            uri: sourceUri.trim() || undefined,
          }]
        : [{
            id: "source-1",
            title: `${name.trim() || "Project"} Knowledge Base`,
            license: licenseKey,
            licenseUrl: preset.url || undefined,
          }],
      capabilities,
    };

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          manifest,
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) setMessage(result.message || "Project could not be created.");
      else window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Project could not be created.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="button button-dark create-project-button" onClick={() => setOpen(true)} type="button">
        New project <span>+</span>
      </button>
    );
  }

  return (
    <form className="project-creator" onSubmit={submit}>
      <label>
        Project name *
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Teyvat Knowledge"
        />
      </label>
      <label>
        Description
        <input
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this project make knowable?"
        />
      </label>

      <div className="creator-manifest-toggle creator-wide">
        <button
          type="button"
          className="manifest-toggle-button"
          onClick={() => setShowManifestFields(!showManifestFields)}
        >
          {showManifestFields ? "− Hide manifest options" : "+ Configure manifest (license, sources, capabilities)"}
        </button>
      </div>

      {showManifestFields && (
        <>
          <label>
            Pack License
            <select
              value={licenseKey}
              onChange={(e) => setLicenseKey(e.target.value)}
              style={{ background: "#fff", border: "1px solid var(--line)", padding: 10, font: "13px Arial" }}
            >
              <option value="CC-BY-4.0">CC-BY-4.0 (Creative Commons Attribution 4.0)</option>
              <option value="MIT">MIT License</option>
              <option value="Apache-2.0">Apache 2.0</option>
              <option value="CC0-1.0">CC0 1.0 (Public Domain)</option>
              <option value="Proprietary">Proprietary / Custom</option>
            </select>
          </label>
          <label>
            Rights Holder / Author
            <input
              value={rightsHolder}
              onChange={(e) => setRightsHolder(e.target.value)}
              placeholder="e.g. Acme Corp or Your Name"
            />
          </label>
          <label>
            Primary Source Title
            <input
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="e.g. Official Documentation"
            />
          </label>
          <label>
            Source Documentation / Repository URI
            <input
              value={sourceUri}
              onChange={(e) => setSourceUri(e.target.value)}
              placeholder="https://github.com/..."
            />
          </label>
          <div className="creator-wide capabilities-group" style={{ display: "grid", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", fontFamily: "var(--font-geist-mono), monospace" }}>Capabilities</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "none", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={capabilities.structuredEntities}
                  onChange={(e) => setCapabilities({ ...capabilities, structuredEntities: e.target.checked })}
                />
                Structured Entities
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "none", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={capabilities.relations}
                  onChange={(e) => setCapabilities({ ...capabilities, relations: e.target.checked })}
                />
                Relations
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "none", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={capabilities.revisions}
                  onChange={(e) => setCapabilities({ ...capabilities, revisions: e.target.checked })}
                />
                Revisions
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "none", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={capabilities.lexicalSearch}
                  onChange={(e) => setCapabilities({ ...capabilities, lexicalSearch: e.target.checked })}
                />
                Lexical Search
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 5, textTransform: "none", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={capabilities.semanticSearch}
                  onChange={(e) => setCapabilities({ ...capabilities, semanticSearch: e.target.checked })}
                />
                Semantic Search
              </label>
            </div>
          </div>
        </>
      )}

      {message && <p className="creator-error">{message}</p>}
      <div className="creator-actions creator-wide" style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button className="button button-primary" disabled={busy} type="submit">
          {busy ? "Creating…" : "Create project"}
        </button>
        <button className="button button-dark" onClick={() => setOpen(false)} type="button">
          Cancel
        </button>
      </div>
    </form>
  );
}
