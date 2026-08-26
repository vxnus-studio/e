import { NextResponse } from "next/server";
import { registry } from "@/lib/registry";

export async function GET(request: Request, { params }: { params: Promise<{ publisher: string; name: string }> }) {
  const { publisher, name } = await params;
  const packageId = `@${publisher}/${name}`;
  const version = new URL(request.url).searchParams.get("version") ?? undefined;
  const pack = await registry.get(packageId, version);
  if (!pack) return NextResponse.json({ error: "pack_not_found", packageName: packageId, version }, { status: 404 });
  return NextResponse.json(pack);
}
