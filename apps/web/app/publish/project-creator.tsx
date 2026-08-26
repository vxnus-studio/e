"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const [activeTab, setActiveTab] = useState<"basics" | "manifest">("basics");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
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

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) setOpen(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

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
            id: "primary-source",
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
          visibility,
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

  return (
    <>
      <button className="button button-dark create-project-button" onClick={() => setOpen(true)} type="button">
        New project <span>+</span>
      </button>

      {open && (
        <div className="drawer-backdrop" onClick={() => setOpen(false)}>
          <div className="drawer-panel" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <span className="dashboard-kicker">Workspace</span>
                <h2>New Knowledge Project</h2>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <nav className="drawer-tabs" aria-label="Creation mode">
              <button
                type="button"
                className={`drawer-tab ${activeTab === "basics" ? "active" : ""}`}
                onClick={() => setActiveTab("basics")}
              >
                1. Project Identity
              </button>
              <button
                type="button"
                className={`drawer-tab ${activeTab === "manifest" ? "active" : ""}`}
                onClick={() => setActiveTab("manifest")}
              >
                2. Manifest & License
              </button>
            </nav>

            <form onSubmit={submit} className="drawer-body">
              {activeTab === "basics" && (
                <div className="drawer-form-fields">
                  <label>
                    Project name *
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      autoFocus
                      placeholder="e.g. Teyvat Knowledge"
                    />
                    <small>Creates the package namespace <code>@{`{username}`}/{name.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "name"}</code></small>
                  </label>

                  <label>
                    Visibility
                    <select value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}>
                      <option value="public">Public (Discoverable on Hub & CLI)</option>
                      <option value="private">Private (Workspace only)</option>
                    </select>
                  </label>

                  <label>
                    Description
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      placeholder="What domain does this knowledge pack make accessible?"
                    />
                  </label>

                  <div className="drawer-hint-box">
                    <span>Tip:</span> You can configure knowledge sources, licenses, and AI search capabilities now or update them anytime in project settings.
                  </div>
                </div>
              )}

              {activeTab === "manifest" && (
                <div className="drawer-form-fields">
                  <label>
                    Default License
                    <select value={licenseKey} onChange={(e) => setLicenseKey(e.target.value)}>
                      <option value="CC-BY-4.0">CC-BY-4.0 (Creative Commons Attribution 4.0)</option>
                      <option value="MIT">MIT License</option>
                      <option value="Apache-2.0">Apache License 2.0</option>
                      <option value="CC0-1.0">CC0 1.0 (Public Domain)</option>
                      <option value="Proprietary">Proprietary / Custom</option>
                    </select>
                  </label>

                  <label>
                    Rights Holder / Author
                    <input
                      value={rightsHolder}
                      onChange={(e) => setRightsHolder(e.target.value)}
                      placeholder="e.g. Acme Corp or vxnus"
                    />
                  </label>

                  <div style={{ borderTop: "1px solid #dce2db", paddingTop: 12 }}>
                    <label>
                      Primary Knowledge Source Title
                      <input
                        value={sourceTitle}
                        onChange={(e) => setSourceTitle(e.target.value)}
                        placeholder="e.g. Official Documentation"
                      />
                    </label>
                  </div>

                  <label>
                    Source Documentation / Repository URI
                    <input
                      value={sourceUri}
                      onChange={(e) => setSourceUri(e.target.value)}
                      placeholder="https://github.com/..."
                    />
                  </label>

                  <div className="capabilities-box">
                    <span className="capabilities-label">Capabilities</span>
                    <div className="capabilities-checks">
                      <label>
                        <input
                          type="checkbox"
                          checked={capabilities.structuredEntities}
                          onChange={(e) => setCapabilities({ ...capabilities, structuredEntities: e.target.checked })}
                        />
                        Structured Entities
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={capabilities.relations}
                          onChange={(e) => setCapabilities({ ...capabilities, relations: e.target.checked })}
                        />
                        Relations
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={capabilities.revisions}
                          onChange={(e) => setCapabilities({ ...capabilities, revisions: e.target.checked })}
                        />
                        Revisions
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={capabilities.lexicalSearch}
                          onChange={(e) => setCapabilities({ ...capabilities, lexicalSearch: e.target.checked })}
                        />
                        Lexical Search
                      </label>
                      <label>
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

              {message && <p className="creator-error" style={{ margin: "0 24px" }}>{message}</p>}

              <div className="drawer-footer">
                <button className="button button-dark" onClick={() => setOpen(false)} type="button">
                  Cancel
                </button>
                <button className="button button-primary" disabled={busy} type="submit">
                  {busy ? "Creating…" : "Create project ↗"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
