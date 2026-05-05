import { NextResponse } from "next/server";
import { searchCoins, getPrice } from "@/lib/coingecko";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const id = searchParams.get("id");

  if (id) {
    const price = await getPrice(id);
    return NextResponse.json({ id, price });
  }

  const coins = await searchCoins(q);
  return NextResponse.json({ coins });
}
