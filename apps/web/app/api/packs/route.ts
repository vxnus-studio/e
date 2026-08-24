import { NextResponse } from "next/server";
import { registry } from "@/lib/registry";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = await registry.search({ query: url.searchParams.get("q") ?? undefined, limit: Number(url.searchParams.get("limit")) || undefined });
  return NextResponse.json(result);
}
