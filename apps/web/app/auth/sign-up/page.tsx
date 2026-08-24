import { AuthView } from "@neondatabase/auth-ui";
import Link from "next/link";

export default function SignUpPage() {
  return <main className="auth-page"><Link className="auth-brand" href="/">E knowledge hub</Link><section className="auth-panel"><p className="eyebrow">For knowledge publishers</p><h1>Create your Hub account.</h1><AuthView path="sign-up" /></section></main>;
}
