"use client";

import { useState } from "react";
import Link from "next/link";
import { projectSlug } from "@/lib/project-slug";
import { PublishForm } from "../../publish-form";
import { ProjectSettings } from "../../project-settings";
import type { PublisherProject } from "@/lib/supabase-control-plane";

type ReleaseItem = {
  id: string;
  projectName: string;
  publisher: string;
  packageId: string;
  version: string;
  status: string;
  createdAt: Date;
  distributionStatus: string | null;
  checksum: string | null;
};

type ProjectViewProps = {
  project: PublisherProject;
  releases: ReleaseItem[];
};

export function ProjectView({ project, releases }: ProjectViewProps) {
  const [activeTab, setActiveTab] = useState<"releases" | "publish" | "settings">("releases");
  const slug = projectSlug(project.name);

  return (
    <div className="project-view-container">
      {/* Project Topbar */}
      <header className="dashboard-topbar">
        <div>
          <span className="breadcrumb">
            Workspace <b>/</b> <Link href="/publish/projects">Projects</Link> <b>/</b> {project.name}
          </span>
          <h1>{project.name}</h1>
          <p className="dashboard-subtitle">
            @{project.publisher} · {project.description || "Knowledge project"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link
            className="button button-dark"
            href={`/projects/${project.publisher}/${slug}`}
            target="_blank"
          >
            View public page ↗
          </Link>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="project-tab-nav" aria-label="Project sections">
        <button
          type="button"
          className={`project-tab-btn ${activeTab === "releases" ? "active" : ""}`}
          onClick={() => setActiveTab("releases")}
        >
          <span>Versions & Releases</span>
          <span className="tab-count-pill">{releases.length}</span>
        </button>
        <button
          type="button"
          className={`project-tab-btn ${activeTab === "publish" ? "active" : ""}`}
          onClick={() => setActiveTab("publish")}
        >
          <span>+ Ship New Release</span>
        </button>
        <button
          type="button"
          className={`project-tab-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          <span>Manifest & Settings</span>
        </button>
      </nav>

      {/* Tab 1: Releases */}
      {activeTab === "releases" && (
        <section className="dashboard-section tab-content">
          <div className="section-bar">
            <div>
              <span className="dashboard-kicker">Release History</span>
              <h2>Published Versions</h2>
            </div>
            <button
              type="button"
              className="button button-primary"
              style={{ fontSize: 11, padding: "8px 14px" }}
              onClick={() => setActiveTab("publish")}
            >
              + Ship new release
            </button>
          </div>

          {releases.length ? (
            <div className="release-table-wrap">
              <table className="release-table">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Published</th>
                    <th>Checksum</th>
                  </tr>
                </thead>
                <tbody>
                  {releases.map((release) => (
                    <tr key={release.id}>
                      <td>
                        <strong>{release.packageId}</strong>
                      </td>
                      <td>
                        <code>v{release.version}</code>
                      </td>
                      <td>
                        <span className="table-status">
                          <i />
                          {release.distributionStatus || release.status}
                        </span>
                      </td>
                      <td>
                        {new Date(release.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <code>{release.checksum ? `${release.checksum.slice(0, 12)}…` : "—"}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="dashboard-empty">
              <span className="empty-mark">+</span>
              <div>
                <h3>No releases yet</h3>
                <p>Ship your first version via local archive upload or remote provider handshake.</p>
                <button
                  type="button"
                  className="button button-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => setActiveTab("publish")}
                >
                  Ship first release ↗
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Tab 2: Ship Release */}
      {activeTab === "publish" && (
        <section className="dashboard-upload tab-content" style={{ marginTop: 24, borderRadius: 2 }}>
          <div>
            <span className="dashboard-kicker">New Release</span>
            <h2>Ship a version.</h2>
            <p>
              Upload a portable E archive (<code>.tar.gz</code>) or connect a verified remote provider endpoint for <strong>{project.name}</strong>.
            </p>
            <div style={{ marginTop: 28 }}>
              <button
                type="button"
                className="button button-dark"
                style={{ fontSize: 11 }}
                onClick={() => setActiveTab("releases")}
              >
                ← Back to release history
              </button>
            </div>
          </div>
          <PublishForm projectId={project.id} />
        </section>
      )}

      {/* Tab 3: Settings & Manifest */}
      {activeTab === "settings" && (
        <section className="tab-content" style={{ marginTop: 10 }}>
          <ProjectSettings project={project} releaseCount={releases.length} />
        </section>
      )}
    </div>
  );
}
