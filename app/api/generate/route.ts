import { NextResponse } from "next/server";

import { expandKeyword, extractPosterKeywords, formatPosterTitle } from "@/lib/keywordExpand";
import { searchImage, UnsplashError } from "@/lib/unsplash";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;
const POSTER_CACHE_TTL_MS = 5 * 60_000;

const requestCounts = new Map<string, { count: number; resetAt: number }>();
const posterCache = new Map<
  string,
  {
    expiresAt: number;
    payload: {
      title: string;
      queries: string[];
      keywords: string[];
      images: Array<{
        query: string;
        url: string | null;
      }>;
    };
  }
>();
const inFlightRequests = new Map<
  string,
  Promise<{
    title: string;
    queries: string[];
    keywords: string[];
    images: Array<{
      query: string;
      url: string | null;
    }>;
  }>
>();

function getClientId(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "anonymous";
  }

  return realIp?.trim() || "anonymous";
}

function enforceRateLimit(clientId: string) {
  const now = Date.now();
  const current = requestCounts.get(clientId);

  if (!current || current.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    requestCounts.set(clientId, { count: 1, resetAt });

    return {
      limited: false,
      retryAfterSeconds: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
    };
  }

  if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      limited: true,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
    };
  }

  current.count += 1;
  requestCounts.set(clientId, current);

  return {
    limited: false,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

function errorResponse(message: string, status: number, retryAfterSeconds?: number) {
  return NextResponse.json(
    {
      error: message
    },
    {
      status,
      headers:
        retryAfterSeconds !== undefined
          ? {
              "Retry-After": String(retryAfterSeconds)
            }
          : undefined
    }
  );
}

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function getFallbackKeyword(keyword: string) {
  const fallback = keyword.replace(/\bcore\b/gi, "").replace(/\s+/g, " ").trim();

  return fallback.length > 0 ? fallback : null;
}

async function resolveImages(queries: string[]) {
  return Promise.all(
    queries.map(async (query) => {
      try {
        return {
          query,
          url: await searchImage(query)
        };
      } catch (caughtError) {
        if (
          caughtError instanceof UnsplashError &&
          (caughtError.status === 429 || caughtError.code === "missing_key")
        ) {
          throw caughtError;
        }

        return {
          query,
          url: null
        };
      }
    })
  );
}

export async function POST(request: Request) {
  try {
    const rateLimit = enforceRateLimit(getClientId(request));

    if (rateLimit.limited) {
      return errorResponse(
        "Too many poster requests. Try again in a minute.",
        429,
        rateLimit.retryAfterSeconds
      );
    }

    const body = (await request.json()) as {
      keyword?: string;
    };

    const keyword = body.keyword?.trim();

    if (!keyword || keyword.length > 80) {
      return errorResponse("Enter a keyword between 1 and 80 characters.", 400);
    }

    const normalizedKeyword = normalizeKeyword(keyword);
    const now = Date.now();
    const cachedPoster = posterCache.get(normalizedKeyword);

    if (cachedPoster && cachedPoster.expiresAt > now) {
      return NextResponse.json(cachedPoster.payload);
    }

    const inFlight = inFlightRequests.get(normalizedKeyword);

    if (inFlight) {
      return NextResponse.json(await inFlight);
    }

    const payloadPromise = (async () => {
      let effectiveKeyword = keyword;
      let queries = expandKeyword(keyword);
      let images = await resolveImages(queries);

      if (images.every((image) => !image.url)) {
        const fallbackKeyword = getFallbackKeyword(keyword);

        if (fallbackKeyword && normalizeKeyword(fallbackKeyword) !== normalizedKeyword) {
          effectiveKeyword = fallbackKeyword;
          queries = expandKeyword(fallbackKeyword);
          images = await resolveImages(queries);
        }
      }

      if (images.every((image) => !image.url)) {
        throw new UnsplashError("Couldn't find images for this core.", {
          code: "no_results",
          status: 404
        });
      }

      const payload = {
        title: formatPosterTitle(keyword),
        queries,
        keywords: extractPosterKeywords(effectiveKeyword, queries),
        images
      };

      posterCache.set(normalizedKeyword, {
        expiresAt: now + POSTER_CACHE_TTL_MS,
        payload
      });

      return payload;
    })();

    inFlightRequests.set(normalizedKeyword, payloadPromise);

    try {
      return NextResponse.json(await payloadPromise);
    } finally {
      inFlightRequests.delete(normalizedKeyword);
    }
  } catch (caughtError) {
    if (caughtError instanceof UnsplashError) {
      if (caughtError.code === "no_results") {
        return errorResponse(caughtError.message, 404);
      }

      if (caughtError.code === "missing_key") {
        return errorResponse("Image source is not configured on the server.", 503);
      }

      if (caughtError.status === 429) {
        return errorResponse(
          "Image search is temporarily rate limited. Try again shortly.",
          429,
          60
        );
      }

      return errorResponse("Image search failed while building this poster.", caughtError.status);
    }

    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to generate poster.";

    return errorResponse(message, 500);
  }
}
