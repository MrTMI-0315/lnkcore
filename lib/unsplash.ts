const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";
const IMAGE_CACHE_TTL_MS = 10 * 60_000;
const MAX_RANDOM_PAGE = 5;
const MAX_RETRIES = 2;
const RESULTS_PER_PAGE = 5;
const GENERIC_FALLBACK_QUERIES = [
  "city night aesthetic",
  "rainy window moody",
  "cozy interior film",
  "street photography night"
];
const STYLE_STOP_WORDS = new Set([
  "aesthetic",
  "cinematic",
  "film",
  "moody",
  "night",
  "photography",
  "street"
]);

const imageCache = new Map<
  string,
  {
    expiresAt: number;
    urls: string[];
  }
>();
const inFlightSearches = new Map<string, Promise<string[]>>();

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

type SearchImageOptions = {
  excludeUrls?: Set<string>;
  onEvent?: (event: SearchImageEvent) => void;
};

type SearchImageEvent =
  | {
      type: "fallback_query";
      fallbackQuery: string;
      originalQuery: string;
    }
  | {
      type: "retry";
      attempt: number;
      query: string;
    };

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function selectPage(query: string, attempt: number) {
  return (hashString(`${query}:${attempt}`) % MAX_RANDOM_PAGE) + 1;
}

function dedupeUrls(urls: string[]) {
  return urls.filter((url, index, list) => list.indexOf(url) === index);
}

function selectImageUrl(
  query: string,
  urls: string[],
  excludeUrls?: Set<string>
) {
  const availableUrls = urls.filter((url) => !excludeUrls?.has(url));

  if (availableUrls.length === 0) {
    return null;
  }

  const candidatePool = availableUrls.slice(0, Math.min(3, availableUrls.length));
  const selectedIndex = hashString(query) % candidatePool.length;

  return candidatePool[selectedIndex] ?? candidatePool[0] ?? null;
}

function compactQuery(query: string) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !STYLE_STOP_WORDS.has(word))
    .join(" ");
}

function extractSubjectQueries(query: string) {
  const compacted = compactQuery(query);
  const words = compacted.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const phrases = [
    words.slice(0, Math.min(3, words.length)).join(" "),
    words.slice(0, Math.min(2, words.length)).join(" "),
    words.slice(-2).join(" "),
    words.at(-1)
  ];

  return dedupeUrls(phrases.filter((value): value is string => Boolean(value)));
}

function buildFallbackQueries(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const compactedQuery = compactQuery(normalizedQuery);
  const subjectQueries = extractSubjectQueries(normalizedQuery);
  const strippedQuery = normalizedQuery.replace(/\bcore\b/g, "").trim();

  return dedupeUrls(
    [
      normalizedQuery,
      compactedQuery,
      strippedQuery,
      ...subjectQueries,
      subjectQueries[0] ? `${subjectQueries[0]} aesthetic` : null,
      subjectQueries[0] ? `${subjectQueries[0]} night` : null,
      ...GENERIC_FALLBACK_QUERIES
    ].filter((value): value is string => Boolean(value))
  );
}

async function fetchCandidateUrls(query: string, page: number) {
  const normalizedCacheKey = `${query.trim().toLowerCase()}::${page}`;
  const cachedResult = imageCache.get(normalizedCacheKey);

  if (cachedResult && cachedResult.expiresAt > Date.now()) {
    return cachedResult.urls;
  }

  const existingRequest = inFlightSearches.get(normalizedCacheKey);

  if (existingRequest) {
    return existingRequest;
  }

  const accessKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!accessKey) {
    throw new UnsplashError("UNSPLASH_ACCESS_KEY is missing.", {
      code: "missing_key",
      status: 503
    });
  }

  const url = new URL(UNSPLASH_ENDPOINT);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(RESULTS_PER_PAGE));
  url.searchParams.set("orientation", "squarish");
  url.searchParams.set("content_filter", "high");

  const requestPromise = (async () => {
    if (process.env.NODE_ENV !== "production") {
      console.log("Unsplash query:", query, "page:", page);
    }

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
    const urls = dedupeUrls(
      payload.results
        ?.map((result) => result.urls?.small)
        .filter((candidate): candidate is string => Boolean(candidate)) ?? []
    );

    imageCache.set(normalizedCacheKey, {
      expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
      urls
    });

    return urls;
  })();

  inFlightSearches.set(normalizedCacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightSearches.delete(normalizedCacheKey);
  }
}

export async function searchImage(
  query: string,
  options: SearchImageOptions = {}
) {
  const normalizedQuery = query.trim().toLowerCase();
  const fallbackQueries = buildFallbackQueries(query);

  for (const fallbackQuery of fallbackQueries) {
    if (fallbackQuery !== normalizedQuery) {
      options.onEvent?.({
        type: "fallback_query",
        fallbackQuery,
        originalQuery: normalizedQuery
      });
    }

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      if (attempt > 0) {
        options.onEvent?.({
          type: "retry",
          attempt,
          query: fallbackQuery
        });
      }

      const candidateUrls = await fetchCandidateUrls(
        fallbackQuery,
        selectPage(fallbackQuery, attempt)
      );
      const selectedUrl = selectImageUrl(
        `${normalizedQuery}:${fallbackQuery}:${attempt}`,
        candidateUrls,
        options.excludeUrls
      );

      if (selectedUrl) {
        return selectedUrl;
      }
    }
  }

  return null;
}
