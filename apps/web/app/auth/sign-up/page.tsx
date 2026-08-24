import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";
import { AuthForm } from "../auth-form";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  const { data: session } = await auth.getSession();
  if (session?.user) redirect("/publish");
  return <main className="auth-page"><div className="auth-layout"><aside className="auth-aside"><Link className="auth-brand" href="/">E knowledge hub</Link><div className="auth-aside-copy"><p className="eyebrow">For knowledge publishers</p><p className="auth-aside-title">A clear home for knowledge that travels.</p><p className="auth-aside-note">Create an account to publish versioned, cited packs for Siduri.</p></div><span className="auth-aside-index">E / 01</span></aside><section className="auth-panel" aria-labelledby="sign-up-title"><Link className="auth-back" href="/">← Back to the Hub</Link><p className="eyebrow">Create an account</p><h1 id="sign-up-title">Start publishing.</h1><p className="auth-intro">Your account is the key to managing packs and revisions.</p><AuthForm mode="sign-up" /></section></div></main>;
}
