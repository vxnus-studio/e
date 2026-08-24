import { auth } from "@/lib/auth-server";
import { getDatabase } from "@/db";
import { publisherProfiles } from "@/db/schema";

export async function POST(request: Request) {
  const { data: session } = await auth.getSession();
  if (!session?.user) return Response.json({ message: "Sign in to choose a username." }, { status: 401 });
  const body = await request.json() as { username?: string };
  const username = String(body.username || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(username)) return Response.json({ message: "Username must use 2–31 lowercase letters, numbers, or hyphens." }, { status: 400 });
  try { await getDatabase().insert(publisherProfiles).values({ userId: session.user.id, username }); return Response.json({ username }, { status: 201 }); }
  catch (error) { return Response.json({ message: /unique|duplicate/i.test(String(error)) ? "That username is already taken." : "Username could not be saved." }, { status: 400 }); }
}
