import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./logout-button";

type DashboardSection = "overview" | "projects" | "releases";

export function DashboardShell({ active, email, children }: { active: DashboardSection; email?: string | null; children: ReactNode }) {
  return <main className="dashboard-page">
    <aside className="dashboard-sidebar">
      <Link className="dashboard-logo" href="/"><span className="brand-mark">E</span><span>knowledge hub</span></Link>
      <div className="sidebar-group"><span className="sidebar-label">Workspace</span>
        <Link className={`sidebar-link${active === "overview" ? " active" : ""}`} href="/publish"><span className="sidebar-icon">/</span>Overview</Link>
        <Link className={`sidebar-link${active === "projects" ? " active" : ""}`} href="/publish/projects"><span className="sidebar-icon">□</span>Projects</Link>
      </div>
      <div className="sidebar-group sidebar-bottom"><span className="sidebar-label">Account</span><Link className="sidebar-link" href="/">Catalog</Link><span className="sidebar-user">{email || "Publisher"}</span><LogoutButton /></div>
    </aside>
    <section className="dashboard-main">{children}</section>
  </main>;
}
