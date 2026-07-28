import { NextRequest, NextResponse } from "next/server";
import { sessionCookie, validPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json() as { password?: string };
  if (!body.password || !validPassword(body.password)) return NextResponse.json({ error: "비밀번호가 맞지 않아요." }, { status: 401 });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, sessionCookie.value(), sessionCookie.options);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  return response;
}
