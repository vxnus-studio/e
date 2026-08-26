"use client";

import { FormEvent, useState } from "react";

export function PublishForm({ projectId }: { projectId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [providerKey, setProviderKey] = useState<string | null>(null);
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("");
  const [apiContractText, setApiContractText] = useState("");
  const [keyBusy, setKeyBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ kind: "error" | "success"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const url = String(data.get("url") || "").trim();
    const apiKey = providerKey || "";

    if (mode === "file" && !file) {
      return setStatus({ kind: "error", message: "Choose a .tar.gz pack to continue." });
    }
    if (mode === "url" && !url) {
      return setStatus({ kind: "error", message: "Enter a provider URL to continue." });
    }
    if (mode === "url" && !apiKey) {
      return setStatus({ kind: "error", message: "Generate a provider key and add it to your provider environment first." });
    }
    if (!projectId) {
      return setStatus({ kind: "error", message: "Create a project before publishing a release." });
    }

    setBusy(true);
    setStatus(null);

    const body = new FormData();
    body.append("projectId", projectId);
    body.append("kind", mode);
    if (file) body.append("pack", file);
    if (url) body.append("url", url);
    if (apiKey) body.append("apiKey", apiKey);
    body.append("version", version);
    if (description) body.append("description", description);
    if (apiContractText.trim()) body.append("apiContract", apiContractText.trim());

    try {
      const response = await fetch("/api/publish", { method: "POST", body });
      const result = (await response.json()) as { message?: string; packageId?: string; version?: string };
      if (!response.ok) throw new Error(result.message || "The pack could not be published.");
      setStatus({ kind: "success", message: `${result.packageId} v${result.version} is ready in the catalog.` });
      setFile(null);
      setProviderKey(null);
      setCopied(false);
      setApiContractText("");
      form.reset();
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "The pack could not be published." });
    } finally {
      setBusy(false);
    }
  }

  async function generateProviderKey() {
    setKeyBusy(true);
    setStatus(null);
    setCopied(false);
    try {
      const response = await fetch("/api/provider-key", { method: "POST" });
      const result = (await response.json()) as { key?: string; message?: string };
      if (!response.ok || !result.key) throw new Error(result.message || "The provider key could not be generated.");
      setProviderKey(result.key);
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "The provider key could not be generated." });
    } finally {
      setKeyBusy(false);
    }
  }

  async function copyProviderKey() {
    if (!providerKey) return;
    await navigator.clipboard.writeText(`E_PUBLISHER_API_KEY=${providerKey}`);
    setCopied(true);
  }

  return (
    <form className="publish-form" onSubmit={submit}>
      <div className="publish-form-heading">
        <span className="form-index">/ 01</span>
        <h2>New release</h2>
        <p>Publish a local archive or connect a remote provider endpoint.</p>
      </div>

      <div className="publish-modes">
        <button
          type="button"
          className={mode === "file" ? "active" : ""}
          onClick={() => setMode("file")}
        >
          Local file (.tar.gz)
        </button>
        <button
          type="button"
          className={mode === "url" ? "active" : ""}
          onClick={() => setMode("url")}
        >
          Remote provider (API)
        </button>
      </div>

      {mode === "file" ? (
        <label className={`file-drop${file ? " has-file" : ""}`}>
          <input
            type="file"
            accept=".tar.gz,.tgz,application/gzip"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <span className="file-drop-mark">{file ? "✓" : "+"}</span>
          <strong>{file ? file.name : "Choose your pack archive"}</strong>
          <small>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB selected` : "E-compatible .tar.gz, up to 25 MB"}</small>
        </label>
      ) : (
        <div className="provider-fields">
          <label className="provider-url-field">
            <span>Provider URL *</span>
            <input
              name="url"
              type="url"
              required
              placeholder="https://example.com/api/e"
            />
            <small>Public remote endpoint implementing the E handshake.</small>
          </label>

          <div className="form-row">
            <label className="provider-url-field">
              <span>Version *</span>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                required
              />
            </label>
            <label className="provider-url-field">
              <span>Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="E.g. Structured game knowledge"
              />
            </label>
          </div>

          <label className="provider-url-field">
            <span>OpenAPI Contract (JSON)</span>
            <textarea
              value={apiContractText}
              onChange={(e) => setApiContractText(e.target.value)}
              rows={4}
              placeholder='{"openapi": "3.1.0", "info": { "title": "API", "version": "1.0.0" }, "paths": { ... }}'
              style={{
                width: "100%",
                background: "#ffffff",
                border: "1px solid #dce2db",
                color: "#1b2622",
                padding: 10,
                fontFamily: "monospace",
                fontSize: 12,
              }}
            />
            <small>Optional authoritative OpenAPI specification for your provider.</small>
          </label>

          <div className="provider-key-box">
            <div className="provider-key-heading">
              <label>Provider Verification Key</label>
              <button
                type="button"
                className="provider-key-action"
                onClick={generateProviderKey}
                disabled={keyBusy}
              >
                {keyBusy ? "Generating…" : providerKey ? "Regenerate key" : "Generate key"}
              </button>
            </div>
            {providerKey ? (
              <>
                <code>{providerKey}</code>
                <button
                  type="button"
                  className="provider-key-copy"
                  onClick={copyProviderKey}
                >
                  {copied ? "✓ Copied to clipboard" : "Copy environment variable"}
                </button>
                <small>
                  Set <strong>E_PUBLISHER_API_KEY</strong> in your provider, then click <em>Verify and publish</em>.
                </small>
              </>
            ) : (
              <small>
                Generate a publisher key, set it as <strong>E_PUBLISHER_API_KEY</strong> on your provider, then verify.
              </small>
            )}
          </div>
        </div>
      )}

      <button className="button button-primary" disabled={busy} type="submit" style={{ marginTop: 20 }}>
        {busy ? "Publishing release…" : mode === "url" ? "Verify and publish ↗" : "Publish release ↗"}
      </button>

      {status && (
        <p className={`publish-status ${status.kind}`} role="status">
          {status.message}
        </p>
      )}
    </form>
  );
}
