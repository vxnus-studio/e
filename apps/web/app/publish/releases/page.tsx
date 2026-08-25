import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { getPublisherProfile, isControlPlaneConfigured, listPublisherReleases } from "@/lib/supabase-control-plane";
import { DashboardShell } from "../dashboard-shell";
import { UsernameSetup } from "../username-setup";
import "../workspace.css";
import "../dashboard.css";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in?redirectTo=/publish/releases");
  const ready = isControlPlaneConfigured();
  const profile = ready ? await getPublisherProfile(session.user.id) : undefined;
  if (ready && !profile) return <main className="dashboard-page"><section className="dashboard-main"><UsernameSetup /></section></main>;
  const releases = ready ? await listPublisherReleases(session.user.id) : [];
  return <DashboardShell active="releases" email={session.user.email}>
    <header className="dashboard-topbar"><div><span className="breadcrumb">Workspace <b>/</b> Releases</span><h1>Release history.</h1></div></header>
    {!ready && <div className="workspace-notice"><strong>Connect the Supabase database to view releases.</strong><span>Set <code>DATABASE_URL</code> and apply the project migrations.</span></div>}
    <section className="dashboard-section"><div className="section-bar"><div><span className="dashboard-kicker">Published knowledge</span><h2>Releases</h2></div><span className="section-count">{releases.length} total</span></div>
      {releases.length ? <div className="release-table-wrap"><table className="release-table"><thead><tr><th>Package</th><th>Version</th><th>Status</th><th>Published</th><th>Checksum</th></tr></thead><tbody>{releases.map((release) => <tr key={release.id}><td><strong>{release.packageId}</strong></td><td><code>v{release.version}</code></td><td><span className="table-status"><i />{release.distributionStatus || release.status}</span></td><td>{release.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td><code>{release.checksum ? `${release.checksum.slice(0, 10)}…` : "—"}</code></td></tr>)}</tbody></table></div> : <div className="dashboard-empty compact"><span className="empty-mark">↗</span><div><h3>No releases yet</h3><p>Publish a validated archive or remote provider from the overview.</p></div></div>}
    </section>
  </DashboardShell>;
}
