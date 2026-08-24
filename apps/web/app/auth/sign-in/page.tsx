import { AuthView } from "@neondatabase/auth-ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const { data: session } = await auth.getSession();
  if (session?.user) redirect("/publish");
  return <main className="auth-page"><div className="auth-layout"><aside className="auth-aside"><Link className="auth-brand" href="/">E knowledge hub</Link><div className="auth-aside-copy"><p className="eyebrow">Welcome back</p><p className="auth-aside-title">The knowledge layer is waiting.</p><p className="auth-aside-note">Sign in to publish, inspect, and maintain the packs your companion can trust.</p></div><span className="auth-aside-index">E / 02</span></aside><section className="auth-panel" aria-labelledby="sign-in-title"><Link className="auth-back" href="/">← Back to the Hub</Link><p className="eyebrow">Publisher access</p><h1 id="sign-in-title">Welcome back.</h1><p className="auth-intro">Sign in to continue managing your knowledge packs.</p><AuthView path="sign-in" /></section></div></main>;
}
