"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { KnowledgePackManifest, PackSource } from "@vxnus/e";

type ProjectSettingsProps = {
  project: {
    id: string;
    name: string;
    description: string | null;
    visibility: "private" | "public";
    manifest?: Partial<KnowledgePackManifest> | null;
    publisher: string;
    created_at: string;
    updated_at: string;
  };
  releaseCount: number;
};

const LICENSE_PRESETS: Record<string, { name: string; url: string }> = {
  "CC-BY-4.0": { name: "Creative Commons Attribution 4.0 International", url: "https://creativecommons.org/licenses/by/4.0/" },
  "MIT": { name: "MIT License", url: "https://opensource.org/licenses/MIT" },
  "Apache-2.0": { name: "Apache License 2.0", url: "https://www.apache.org/licenses/LICENSE-2.0" },
  "CC0-1.0": { name: "Creative Commons Zero v1.0 Universal", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "Proprietary": { name: "Proprietary / All Rights Reserved", url: "" },
};

function projectSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ProjectSettings({ project, releaseCount }: ProjectSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [visibility, setVisibility] = useState(project.visibility);

  // Manifest editor state
  const initialManifest = project.manifest || {};
  const [manifestMode, setManifestMode] = useState<"visual" | "json">("visual");
  const [licenseKey, setLicenseKey] = useState(initialManifest.license?.license || "CC-BY-4.0");
  const [licenseName, setLicenseName] = useState(initialManifest.license?.licenseName || LICENSE_PRESETS["CC-BY-4.0"].name);
  const [licenseUrl, setLicenseUrl] = useState(initialManifest.license?.licenseUrl || LICENSE_PRESETS["CC-BY-4.0"].url);
  const [rightsHolder, setRightsHolder] = useState(initialManifest.license?.rightsHolder || "");
  const [copyrightNotice, setCopyrightNotice] = useState(initialManifest.license?.copyrightNotice || "");
  const [attributionText, setAttributionText] = useState(initialManifest.license?.attributionText || "");

  const [sources, setSources] = useState<PackSource[]>(
    initialManifest.sources && initialManifest.sources.length > 0
      ? initialManifest.sources
      : [{ id: "primary-source", title: `${project.name} Knowledge Base`, license: "CC-BY-4.0" }]
  );

  const [capabilities, setCapabilities] = useState({
    structuredEntities: initialManifest.capabilities?.structuredEntities ?? true,
    relations: initialManifest.capabilities?.relations ?? true,
    revisions: initialManifest.capabilities?.revisions ?? true,
    lexicalSearch: initialManifest.capabilities?.lexicalSearch ?? false,
    semanticSearch: initialManifest.capabilities?.semanticSearch ?? false,
  });

  const [rawJson, setRawJson] = useState(() => JSON.stringify(initialManifest, null, 2));
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function handleLicensePresetChange(key: string) {
    setLicenseKey(key);
    if (LICENSE_PRESETS[key]) {
      setLicenseName(LICENSE_PRESETS[key].name);
      setLicenseUrl(LICENSE_PRESETS[key].url);
    }
  }

  function addSource() {
    setSources([
      ...sources,
      { id: `source-${sources.length + 1}`, title: "New Source", license: licenseKey, uri: "" },
    ]);
  }

  function updateSource(index: number, patch: Partial<PackSource>) {
    setSources(sources.map((src, i) => (i === index ? { ...src, ...patch } : src)));
  }

  function removeSource(index: number) {
    if (sources.length <= 1) return;
    setSources(sources.filter((_, i) => i !== index));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);

    let manifestToSave: Partial<KnowledgePackManifest>;
    if (manifestMode === "json") {
      try {
        manifestToSave = JSON.parse(rawJson);
      } catch {
        setStatus({ kind: "error", message: "Invalid Manifest JSON format." });
        setBusy(false);
        return;
      }
    } else {
      manifestToSave = {
        description: description.trim() || undefined,
        license: {
          license: licenseKey.trim(),
          licenseName: licenseName.trim() || licenseKey.trim(),
          licenseUrl: licenseUrl.trim() || "https://choosealicense.com/",
          rightsHolder: rightsHolder.trim() || undefined,
          copyrightNotice: copyrightNotice.trim() || (rightsHolder.trim() ? `© ${new Date().getFullYear()} ${rightsHolder.trim()}` : undefined),
          attributionText: attributionText.trim() || undefined,
        },
        sources: sources.filter((s) => s.title.trim()),
        capabilities,
      };
    }

    try {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          manifest: manifestToSave,
        }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Project could not be updated.");
      setStatus({ kind: "success", message: "Project and manifest settings saved." });
      setRawJson(JSON.stringify(manifestToSave, null, 2));
      if (name !== project.name) router.push(`/publish/${projectSlug(name)}/release`);
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Project could not be updated." });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete ${project.name}? This removes the project and its published registry releases.`)) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message || "Project could not be deleted.");
      router.push("/publish/projects");
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Project could not be deleted." });
      setBusy(false);
    }
  }

  return (
    <section className="project-settings" aria-labelledby="project-settings-title">
      <div className="settings-heading">
        <div>
          <span className="dashboard-kicker">Project controls</span>
          <h2 id="project-settings-title">Settings & Manifest</h2>
        </div>
        <span className={`visibility ${visibility}`}>{visibility}</span>
      </div>

      <div className="settings-grid">
        <form className="settings-form" onSubmit={save}>
          <label>
            Project name *
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="What does this project make knowable?"
            />
          </label>

          <label>
            Visibility
            <select value={visibility} onChange={(event) => setVisibility(event.target.value as "private" | "public")}>
              <option value="private">Private — only you and members</option>
              <option value="public">Public — visible in the catalog</option>
            </select>
          </label>

          {/* Manifest Editor Sub-section */}
          <div style={{ borderTop: "1px solid #d4dcd3", paddingTop: 16, marginTop: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span className="dashboard-kicker" style={{ margin: 0 }}>Pack Manifest Definition</span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className={`button ${manifestMode === "visual" ? "button-primary" : "button-dark"}`}
                  style={{ padding: "4px 8px", fontSize: 10 }}
                  onClick={() => setManifestMode("visual")}
                >
                  Visual Form
                </button>
                <button
                  type="button"
                  className={`button ${manifestMode === "json" ? "button-primary" : "button-dark"}`}
                  style={{ padding: "4px 8px", fontSize: 10 }}
                  onClick={() => {
                    const currentVisualManifest = {
                      description: description.trim() || undefined,
                      license: {
                        license: licenseKey.trim(),
                        licenseName: licenseName.trim() || licenseKey.trim(),
                        licenseUrl: licenseUrl.trim() || "https://choosealicense.com/",
                        rightsHolder: rightsHolder.trim() || undefined,
                        copyrightNotice: copyrightNotice.trim() || undefined,
                        attributionText: attributionText.trim() || undefined,
                      },
                      sources,
                      capabilities,
                    };
                    setRawJson(JSON.stringify(currentVisualManifest, null, 2));
                    setManifestMode("json");
                  }}
                >
                  Raw JSON
                </button>
              </div>
            </div>

            {manifestMode === "json" ? (
              <label>
                Manifest JSON
                <textarea
                  value={rawJson}
                  onChange={(e) => setRawJson(e.target.value)}
                  rows={10}
                  style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 12, background: "#0a0a0a", color: "#e3eae1", border: "1px solid #333" }}
                />
              </label>
            ) : (
              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 10, background: "#eef1eb", padding: 14, border: "1px solid #dce2db" }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: "#69736e", textTransform: "uppercase" }}>License Information</span>
                  <label>
                    Preset
                    <select value={licenseKey} onChange={(e) => handleLicensePresetChange(e.target.value)}>
                      <option value="CC-BY-4.0">CC-BY-4.0 (Creative Commons Attribution 4.0)</option>
                      <option value="MIT">MIT License</option>
                      <option value="Apache-2.0">Apache License 2.0</option>
                      <option value="CC0-1.0">CC0 1.0 (Public Domain)</option>
                      <option value="Proprietary">Proprietary / Custom</option>
                    </select>
                  </label>
                  <label>
                    License Name
                    <input value={licenseName} onChange={(e) => setLicenseName(e.target.value)} />
                  </label>
                  <label>
                    License URL
                    <input value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} />
                  </label>
                  <label>
                    Rights Holder
                    <input value={rightsHolder} onChange={(e) => setRightsHolder(e.target.value)} placeholder="e.g. Acme Corp" />
                  </label>
                </div>

                <div style={{ display: "grid", gap: 10, background: "#eef1eb", padding: 14, border: "1px solid #dce2db" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: "#69736e", textTransform: "uppercase" }}>Knowledge Sources</span>
                    <button type="button" className="button button-dark" style={{ padding: "3px 7px", fontSize: 10 }} onClick={addSource}>
                      + Add Source
                    </button>
                  </div>
                  {sources.map((source, index) => (
                    <div key={index} style={{ borderBottom: "1px solid #d4dcd3", paddingBottom: 10, marginBottom: 6 }}>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            style={{ flex: 1 }}
                            placeholder="Source Title"
                            value={source.title}
                            onChange={(e) => updateSource(index, { title: e.target.value })}
                          />
                          {sources.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeSource(index)}
                              style={{ background: "transparent", border: "1px solid #c65c4b", color: "#a84436", padding: "4px 8px", cursor: "pointer" }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <input
                          placeholder="Source URI (e.g. https://github.com/...)"
                          value={source.uri || ""}
                          onChange={(e) => updateSource(index, { uri: e.target.value })}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: "grid", gap: 8, background: "#eef1eb", padding: 14, border: "1px solid #dce2db" }}>
                  <span style={{ fontSize: 10, fontFamily: "var(--font-geist-mono), monospace", color: "#69736e", textTransform: "uppercase" }}>Capabilities</span>
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
              </div>
            )}
          </div>

          <button className="button button-dark" disabled={busy} type="submit" style={{ marginTop: 12 }}>
            {busy ? "Saving…" : "Save settings & manifest"}
          </button>
          {status && <p className={`settings-status ${status.kind}`} role="status">{status.message}</p>}
        </form>

        <aside className="settings-metadata">
          <span className="dashboard-kicker">Metadata</span>
          <dl>
            <div>
              <dt>Publisher</dt>
              <dd>@{project.publisher}</dd>
            </div>
            <div>
              <dt>Project ID</dt>
              <dd><code>{project.id}</code></dd>
            </div>
            <div>
              <dt>Releases</dt>
              <dd>{releaseCount}</dd>
            </div>
            <div>
              <dt>License</dt>
              <dd><code>{licenseKey}</code></dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(project.created_at)}</dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>{formatDate(project.updated_at)}</dd>
            </div>
          </dl>
        </aside>
      </div>

      <div className="danger-zone">
        <div>
          <span className="dashboard-kicker">Danger zone</span>
          <h3>Delete this project</h3>
          <p>Removes the project, its release history, and registry entries. This cannot be undone.</p>
        </div>
        <button className="button button-danger" disabled={busy} onClick={remove} type="button">
          Delete project
        </button>
      </div>
    </section>
  );
}
