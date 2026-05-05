import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { follow, unfollow } from "@/lib/follows";
import { getUserByUsername } from "@/lib/posts";

export async function POST(req: Request) {
  const me = await getCurrentUser();
  const form = await req.formData();
  const username = String(form.get("username") ?? "").trim();
  const action = String(form.get("action") ?? "follow");

  const back = (target?: string) =>
    NextResponse.redirect(
      new URL(target ? `/u/${target}` : "/", req.url),
      { status: 303 },
    );

  if (!me) return NextResponse.redirect(new URL("/login", req.url), { status: 303 });
  if (!username) return back();

  const target = await getUserByUsername(username);
  if (!target) return back();
  if (target.id === me.id) return back(target.username);

  if (action === "unfollow") {
    await unfollow(me.id, target.id);
  } else {
    await follow(me.id, target.id);
  }
  return back(target.username);
}
