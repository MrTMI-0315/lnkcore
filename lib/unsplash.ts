const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";

export class UnsplashError extends Error {
  code: string;
  status: number;

  constructor(message: string, options: { code: string; status: number }) {
    super(message);
    this.name = "UnsplashError";
    this.code = options.code;
    this.status = options.status;
  }
}

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
    throw new UnsplashError("UNSPLASH_ACCESS_KEY is missing.", {
      code: "missing_key",
      status: 503
    });
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

  if (response.status === 429) {
    throw new UnsplashError("Unsplash rate limit reached.", {
      code: "unsplash_rate_limited",
      status: 429
    });
  }

  if (!response.ok) {
    throw new UnsplashError(`Unsplash search failed for "${query}".`, {
      code: "unsplash_request_failed",
      status: 502
    });
  }

  const payload = (await response.json()) as UnsplashResponse;

  return payload.results?.[0]?.urls?.small ?? null;
}
