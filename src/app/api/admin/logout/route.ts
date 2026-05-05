import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  destroyAdminSession,
  getAdminSessionToken,
  getCurrentAdmin,
} from "@/lib/admin-auth";
import { audit } from "@/lib/audit";

export async function POST(req: Request) {
  const admin = await getCurrentAdmin();
  const token = await getAdminSessionToken();
  if (token) await destroyAdminSession(token);
  await clearAdminSessionCookie();
  if (admin) {
    audit(req, { type: "withdraw.ok", meta: { kind: "admin_logout", email: admin.email } });
  }
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
