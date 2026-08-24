import Link from "next/link";

export default function EmailVerificationPage() {
  return <main className="auth-page"><div className="auth-layout"><aside className="auth-aside"><Link className="auth-brand" href="/">E knowledge hub</Link><div className="auth-aside-copy"><p className="eyebrow">One last step</p><p className="auth-aside-title">Confirm the address behind your account.</p><p className="auth-aside-note">Open the verification email from Supabase, then return here to continue publishing.</p></div><span className="auth-aside-index">E / 03</span></aside><section className="auth-panel" aria-labelledby="verification-title"><Link className="auth-back" href="/auth/sign-in">← Back to sign in</Link><p className="eyebrow">Email verification</p><h1 id="verification-title">Check your inbox.</h1><p className="auth-intro">Verify your email address to activate your Hub account.</p></section></div></main>;
}
