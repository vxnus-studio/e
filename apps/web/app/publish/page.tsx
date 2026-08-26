import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listPublisherProjects, listPublisherReleases } from "@/lib/supabase-control-plane";
import { projectSlug } from "@/lib/project-slug";
import { ProjectCreator } from "./project-creator";
import { DashboardShell } from "./dashboard-shell";
import { UsernameSetup } from "./username-setup";
import "./workspace.css";
import "./dashboard.css";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in?redirectTo=/publish");
  const ready = isControlPlaneConfigured();
  const profile = ready ? await getPublisherProfile(session.user.id) : undefined;
  if (ready && !profile) return <main className="dashboard-page"><section className="dashboard-main"><UsernameSetup /></section></main>;
  const [projects, releases] = ready ? await Promise.all([listPublisherProjects(session.user.id), listPublisherReleases(session.user.id)]) : [[], []];
  const published = releases.filter((release) => release.status === "published").length;

  return (
    <DashboardShell active="overview" email={session.user.email}>
      <header className="dashboard-topbar">
        <div>
          <span className="breadcrumb">Workspace <b>/</b> Overview</span>
          <h1>Good to see you back.</h1>
        </div>
        <ProjectCreator />
      </header>

      {!ready && (
        <div className="workspace-notice">
          <strong>Connect the Supabase database to start publishing.</strong>
          <span>Set <code>DATABASE_URL</code> and apply the project migrations.</span>
        </div>
      )}

      <div className="metric-grid">
        <article>
          <span>Projects</span>
          <strong>{projects.length}</strong>
          <small>owned namespaces</small>
        </article>
        <article>
          <span>Releases</span>
          <strong>{published}</strong>
          <small>published versions</small>
        </article>
        <article>
          <span>Health</span>
          <strong className="metric-good">{ready ? "Ready" : "Setup"}</strong>
          <small>{ready ? "control plane online" : "awaiting database"}</small>
        </article>
      </div>

      <section className="dashboard-section" id="projects">
        <div className="section-bar">
          <div>
            <span className="dashboard-kicker">Your workspace</span>
            <h2>Projects</h2>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="section-count">{projects.length} total</span>
            {projects.length > 0 && (
              <Link href="/publish/projects" className="button button-dark" style={{ fontSize: 10, padding: "6px 10px" }}>
                View all →
              </Link>
            )}
          </div>
        </div>

        {projects.length ? (
          <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
            {projects.map((project) => {
              const slug = projectSlug(project.name);
              const projectReleases = releases.filter((r) => r.projectName === project.name);
              return (
                <article className="project-card" key={project.id} style={{ display: "flex", flexDirection: "column", alignItems: "stretch", padding: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div className="project-card-mark" style={{ width: 42, height: 42, fontSize: 20 }}>E</div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{project.name}</h3>
                        <span className="project-status" style={{ fontSize: 10 }}>@{project.publisher}</span>
                      </div>
                    </div>
                    <span className={`visibility ${project.visibility}`}>{project.visibility}</span>
                  </div>
                  <p style={{ flex: 1, marginBottom: 16, color: "#6c7771", fontSize: 12 }}>
                    {project.description || "Knowledge project"}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #d4dcd3", paddingTop: 12, marginTop: "auto" }}>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{projectReleases.length} releases</span>
                    <Link className="project-open" href={`/publish/${slug}/release`}>
                      Manage project <span>↗</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dashboard-empty">
            <span className="empty-mark">+</span>
            <div>
              <h3>Create your first project</h3>
              <p>A project owns your publisher namespace, sources, revisions, and releases.</p>
            </div>
          </div>
        )}
      </section>

      <section className="dashboard-section" id="releases">
        <div className="section-bar">
          <div>
            <span className="dashboard-kicker">Release history</span>
            <h2>Recent releases</h2>
          </div>
          <span className="section-count">{releases.length} total</span>
        </div>
        {releases.length ? (
          <div className="release-table-wrap">
            <table className="release-table">
              <thead>
                <tr>
                  <th>Project</th>
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
                      <Link href={`/publish/${projectSlug(release.projectName)}/release`} style={{ color: "inherit", textDecoration: "none" }}>
                        <strong>{release.projectName}</strong>
                        <br />
                        <small style={{ color: "var(--muted)" }}>@{release.publisher}</small>
                      </Link>
                    </td>
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
                      <code>{release.checksum ? `${release.checksum.slice(0, 10)}…` : "—"}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="dashboard-empty compact">
            <span className="empty-mark">↗</span>
            <div>
              <h3>No releases yet</h3>
              <p>Publish a validated archive into your project to see its release history here.</p>
            </div>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}
