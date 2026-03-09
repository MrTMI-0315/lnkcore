const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";

type UnsplashResponse = {
  results?: Array<{
    urls?: {
      small?: string;
    };
  }>;
};

export async function searchImage(query: string) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    throw new Error("UNSPLASH_ACCESS_KEY is missing.");
  }

  const url = new URL(UNSPLASH_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1");
  url.searchParams.set("orientation", "squarish");
  url.searchParams.set("content_filter", "high");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      "Accept-Version": "v1"
    },
    next: {
      revalidate: 0
    }
  });

  if (!response.ok) {
    throw new Error(`Unsplash search failed for "${query}".`);
  }

  const payload = (await response.json()) as UnsplashResponse;

  return payload.results?.[0]?.urls?.small ?? null;
}
