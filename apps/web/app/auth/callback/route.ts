import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/auth-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedRedirect = url.searchParams.get("next");
  const redirectTo = requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//") ? requestedRedirect : "/publish";
  if (!code) return NextResponse.redirect(new URL("/auth/sign-in?error=verification", url.origin));
  const supabase = await createAuthServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/auth/sign-in?error=${encodeURIComponent(error.message)}`, url.origin));
  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
