import { NextResponse } from "next/server";
import { clearSessionCookie, destroySession, getSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const token = await getSessionToken();
  if (token) await destroySession(token);
  await clearSessionCookie();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
