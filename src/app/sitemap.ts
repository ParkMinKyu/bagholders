import type { MetadataRoute } from "next";
import { dbAll } from "@/lib/db";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://bagholders.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "always", priority: 1.0 },
    { url: `${SITE_URL}/b`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/ranking`, lastModified: now, changeFrequency: "hourly", priority: 0.8 },
  ];

  // 동적 entries: 최근 항목으로 제한해 sitemap 크기 관리.
  const [posts, boardPosts, users, tickers] = await Promise.all([
    dbAll<{ id: number; created_at: number }>(
      "SELECT id, created_at FROM posts ORDER BY created_at DESC LIMIT 200",
    ).catch(() => []),
    dbAll<{ id: number; created_at: number }>(
      "SELECT id, created_at FROM board_posts ORDER BY created_at DESC LIMIT 200",
    ).catch(() => []),
    dbAll<{ username: string }>(
      `SELECT DISTINCT u.username
       FROM users u JOIN posts p ON p.user_id = u.id
       LIMIT 200`,
    ).catch(() => []),
    dbAll<{ ticker_code: string; last_priced_at: number }>(
      `SELECT ticker_code, MAX(last_priced_at) AS last_priced_at
       FROM posts GROUP BY ticker_code LIMIT 200`,
    ).catch(() => []),
  ]);

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/p/${p.id}`,
    lastModified: new Date(Number(p.created_at)),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const boardEntries: MetadataRoute.Sitemap = boardPosts.map((p) => ({
    url: `${SITE_URL}/b/${p.id}`,
    lastModified: new Date(Number(p.created_at)),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const userEntries: MetadataRoute.Sitemap = users.map((u) => ({
    url: `${SITE_URL}/u/${encodeURIComponent(u.username)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.5,
  }));

  const tickerEntries: MetadataRoute.Sitemap = tickers.map((t) => ({
    url: `${SITE_URL}/t/${encodeURIComponent(t.ticker_code)}`,
    lastModified: new Date(Number(t.last_priced_at)),
    changeFrequency: "daily",
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...postEntries,
    ...boardEntries,
    ...userEntries,
    ...tickerEntries,
  ];
}
