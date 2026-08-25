import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth-server";

export async function POST() {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to generate a provider key." }, { status: 401 });
  const key = `eprov_${randomBytes(32).toString("base64url")}`;
  return Response.json({ key }, { status: 201, headers: { "cache-control": "no-store" } });
}
