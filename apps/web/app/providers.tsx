"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { NeonAuthUIProvider } from "@neondatabase/auth-ui";
import { authClient } from "@/lib/auth-client";

export function Providers({ children }: { children: ReactNode }) {
  return <NeonAuthUIProvider authClient={authClient} defaultTheme="light" navigate={(href) => window.location.assign(href)} replace={(href) => window.location.replace(href)} redirectTo="/publish" Link={Link}>{children}</NeonAuthUIProvider>;
}
