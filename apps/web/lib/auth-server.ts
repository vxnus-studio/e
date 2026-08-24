import { createNeonAuth } from "@neondatabase/auth/next/server";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL || "http://localhost:3000",
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET || "development-only-change-me-please",
    domain: process.env.NEON_AUTH_COOKIE_DOMAIN || undefined,
  },
});
