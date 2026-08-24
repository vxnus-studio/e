import { AuthView } from "@neondatabase/auth-ui";
import Link from "next/link";

export default function SignInPage() {
  return <main className="auth-page"><Link className="auth-brand" href="/">E knowledge hub</Link><section className="auth-panel"><p className="eyebrow">Welcome back</p><h1>Sign in to your Hub account.</h1><AuthView path="sign-in" /></section></main>;
}
