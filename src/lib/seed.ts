import { parseInstagramUrl, type Item } from "./instagram.ts";

/** The batch this app was built from, in the original order. */
export const SEED_URLS = [
  "https://www.instagram.com/p/Dd3tsoHmHuH/",
  "https://www.instagram.com/p/Ddqg_NAmSJ1/",
  "https://www.instagram.com/reel/DaiB5OdoqWX/",
  "https://www.instagram.com/p/Dd2E-qPILqw/",
  "https://www.instagram.com/p/Dd1PXVTgu_Y/",
  "https://www.instagram.com/p/Dc4zUHqDcGp/",
  "https://www.instagram.com/reel/Ddqzf1aTdfS/",
  "https://www.instagram.com/reel/DdkUgu8iM8b/",
  "https://www.instagram.com/reel/DdaXbF1TTxi/",
  "https://www.instagram.com/reel/DdfWR-MIxcL/",
  "https://www.instagram.com/reel/DbMEx31SKVl/",
  "https://www.instagram.com/reel/DdhDKcooi0i/",
  "https://www.instagram.com/reel/DdW3iwivNz3/",
  "https://www.instagram.com/reel/DZDlUBKSmyp/",
  "https://www.instagram.com/p/Ddl-hfiAnWK/",
  "https://www.instagram.com/reel/DdWjxTKhMf1/",
  "https://www.instagram.com/reel/DdMP86BvkTm/",
  "https://www.instagram.com/p/DdhCVo6HZZw/",
  "https://www.instagram.com/p/DdNyQ7QkZ9N/",
  "https://www.instagram.com/p/DdeFgWGiDie/",
  "https://www.instagram.com/p/DdL0FpcDT76/",
  "https://www.instagram.com/p/Dc6veOGFGM9/",
  "https://www.instagram.com/reel/Dc9Oa4ZToJt/",
  "https://www.instagram.com/p/Dc3g5Mdk62c/",
  "https://www.instagram.com/reel/DWg_m0kjPKP/",
  "https://www.instagram.com/reel/DdcOLSAyoXA/",
  "https://www.instagram.com/p/DdYtNhVjKEb/",
  "https://www.instagram.com/reel/DdWuklUKFIP/",
  "https://www.instagram.com/p/DdYrR6RjKMj/",
  "https://www.instagram.com/reel/DdYvOIPT9L-/",
  "https://www.instagram.com/reel/DaGPWTdB8HT/",
  "https://www.instagram.com/reel/ShelfTestReel1/",
  "https://www.instagram.com/reel/DdHHTRbBOa_/",
  "https://www.instagram.com/reel/DdGu9qdBk_d/",
] as const;

export function seedItems(): Item[] {
  return SEED_URLS.map((url) => {
    const parsed = parseInstagramUrl(url);
    if (!parsed) throw new Error(`Seed URL is not a post or reel: ${url}`);
    return { ...parsed, selected: true };
  });
}
