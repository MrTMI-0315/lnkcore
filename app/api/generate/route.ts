import { randomUUID } from "node:crypto";

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
const GENERIC_FILLER_QUERIES = [
  "city night aesthetic",
  "street photography film",
  "urban lights night",
  "moody interior aesthetic",
  "cinematic cafe night",
  "neon city rain"
];

type PosterPayload = {
  title: string;
  queries: string[];
  keywords: string[];
  images: Array<{
    query: string;
    url: string | null;
  }>;
};

type GenerateLogger = (event: string, details?: Record<string, unknown>) => void;

function createLogger(requestId: string): GenerateLogger {
  return (event, details = {}) => {
    console.info(
      JSON.stringify({
        event,
        requestId,
        scope: "poster_generate",
        ...details
      })
    );
  };
}

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

function jsonResponse(
  payload: PosterPayload,
  requestId: string,
  headers?: Record<string, string>
) {
  return NextResponse.json(payload, {
    headers: {
      "x-request-id": requestId,
      ...headers
    }
  });
}

function errorResponseWithRequestId(
  message: string,
  status: number,
  requestId: string,
  retryAfterSeconds?: number
) {
  return NextResponse.json(
    {
      error: message
    },
    {
      status,
      headers: {
        "x-request-id": requestId,
        ...(retryAfterSeconds !== undefined
          ? {
              "Retry-After": String(retryAfterSeconds)
            }
          : {})
      }
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

async function resolveImages(queries: string[], log: GenerateLogger) {
  const initialImages = await Promise.all(
    queries.map(async (query, index) => {
      log("cell_fetch_started", {
        cell: index + 1,
        query
      });

      try {
        const url = await searchImage(query, {
          onEvent: (event) => {
            if (event.type === "fallback_query") {
              log("query_fallback_used", {
                cell: index + 1,
                fallbackQuery: event.fallbackQuery,
                originalQuery: event.originalQuery
              });
            }

            if (event.type === "retry") {
              log("query_retry", {
                attempt: event.attempt,
                cell: index + 1,
                query: event.query
              });
            }
          }
        });

        log(url ? "cell_fetch_succeeded" : "cell_fetch_failed", {
          cell: index + 1,
          query
        });

        return {
          query,
          url
        };
      } catch (caughtError) {
        if (
          caughtError instanceof UnsplashError &&
          (caughtError.status === 429 || caughtError.code === "missing_key")
        ) {
          throw caughtError;
        }

        log("cell_fetch_failed", {
          cell: index + 1,
          error:
            caughtError instanceof Error ? caughtError.message : "unknown_error",
          query
        });

        return {
          query,
          url: null
        };
      }
    })
  );

  const usedUrls = new Set<string>();
  let duplicateFilteredCount = 0;
  const images = initialImages.map((image) => {
    if (!image.url || usedUrls.has(image.url)) {
      if (image.url) {
        duplicateFilteredCount += 1;
      }

      return {
        ...image,
        url: null
      };
    }

    usedUrls.add(image.url);
    return image;
  });

  log("duplicate_filter_applied", {
    duplicateFilteredCount
  });

  const failedIndexes = images
    .map((image, index) => (image.url ? null : index))
    .filter((index): index is number => index !== null);

  const fillerResults = await Promise.all(
    failedIndexes.map(async (failedIndex, offset) => {
      const fillerQuery =
        GENERIC_FILLER_QUERIES[offset % GENERIC_FILLER_QUERIES.length];

      log("filler_fetch_started", {
        cell: failedIndex + 1,
        fillerQuery
      });

      try {
        const url = await searchImage(fillerQuery, {
          excludeUrls: usedUrls,
          onEvent: (event) => {
            if (event.type === "fallback_query") {
              log("query_fallback_used", {
                cell: failedIndex + 1,
                fallbackQuery: event.fallbackQuery,
                originalQuery: event.originalQuery
              });
            }

            if (event.type === "retry") {
              log("query_retry", {
                attempt: event.attempt,
                cell: failedIndex + 1,
                query: event.query
              });
            }
          }
        });

        log(url ? "filler_fetch_succeeded" : "filler_fetch_failed", {
          cell: failedIndex + 1,
          fillerQuery
        });

        return {
          failedIndex,
          query: fillerQuery,
          url
        };
      } catch (caughtError) {
        if (
          caughtError instanceof UnsplashError &&
          (caughtError.status === 429 || caughtError.code === "missing_key")
        ) {
          throw caughtError;
        }

        log("filler_fetch_failed", {
          cell: failedIndex + 1,
          error:
            caughtError instanceof Error ? caughtError.message : "unknown_error",
          fillerQuery
        });

        return {
          failedIndex,
          query: fillerQuery,
          url: null
        };
      }
    })
  );

  let fillerUsedCount = 0;
  for (const fillerResult of fillerResults) {
    if (!fillerResult.url || usedUrls.has(fillerResult.url)) {
      continue;
    }

    usedUrls.add(fillerResult.url);
    images[fillerResult.failedIndex] = {
      query: fillerResult.query,
      url: fillerResult.url
    };
    fillerUsedCount += 1;
  }

  const finalImageCount = images.filter((image) => Boolean(image.url)).length;

  log("image_resolution_completed", {
    duplicateFilteredCount,
    fillerUsedCount,
    finalImageCount
  });

  return {
    duplicateFilteredCount,
    fillerUsedCount,
    finalImageCount,
    images
  };
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  const log = createLogger(requestId);
  let requestedKeyword = "unknown";

  try {
    log("request_started");
    const rateLimit = enforceRateLimit(getClientId(request));

    if (rateLimit.limited) {
      log("request_rate_limited", {
        latencyMs: Date.now() - startedAt,
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });

      return errorResponseWithRequestId(
        "Too many poster requests. Try again in a minute.",
        429,
        requestId,
        rateLimit.retryAfterSeconds
      );
    }

    const body = (await request.json()) as {
      keyword?: string;
    };

    const keyword = body.keyword?.trim();

    if (!keyword || keyword.length > 80) {
      log("request_invalid", {
        keywordLength: keyword?.length ?? 0,
        latencyMs: Date.now() - startedAt
      });

      return errorResponseWithRequestId(
        "Enter a keyword between 1 and 80 characters.",
        400,
        requestId
      );
    }

    requestedKeyword = keyword;
    const normalizedKeyword = normalizeKeyword(keyword);
    log("request_validated", {
      core: keyword
    });

    const now = Date.now();
    const cachedPoster = posterCache.get(normalizedKeyword);

    if (cachedPoster && cachedPoster.expiresAt > now) {
      log("poster_cache_hit", {
        core: keyword,
        finalImageCount: cachedPoster.payload.images.filter((image) => Boolean(image.url)).length,
        latencyMs: Date.now() - startedAt
      });

      return jsonResponse(cachedPoster.payload, requestId);
    }

    const inFlight = inFlightRequests.get(normalizedKeyword);

    if (inFlight) {
      log("poster_inflight_reused", {
        core: keyword
      });

      const payload = await inFlight;
      log("request_completed", {
        core: keyword,
        finalImageCount: payload.images.filter((image) => Boolean(image.url)).length,
        latencyMs: Date.now() - startedAt
      });

      return jsonResponse(payload, requestId);
    }

    const payloadPromise = (async () => {
      let effectiveKeyword = keyword;
      let queries = expandKeyword(keyword);
      log("queries_expanded", {
        core: keyword,
        expandedQueries: queries
      });
      let resolution = await resolveImages(queries, log);
      let images = resolution.images;

      if (images.every((image) => !image.url)) {
        const fallbackKeyword = getFallbackKeyword(keyword);

        if (fallbackKeyword && normalizeKeyword(fallbackKeyword) !== normalizedKeyword) {
          effectiveKeyword = fallbackKeyword;
          queries = expandKeyword(fallbackKeyword);
          log("keyword_fallback_used", {
            fallbackKeyword,
            originalKeyword: keyword
          });
          log("queries_expanded", {
            core: fallbackKeyword,
            expandedQueries: queries
          });
          resolution = await resolveImages(queries, log);
          images = resolution.images;
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

      log("poster_cached", {
        core: keyword,
        duplicateFilteredCount: resolution.duplicateFilteredCount,
        fillerUsedCount: resolution.fillerUsedCount,
        finalImageCount: resolution.finalImageCount
      });

      return payload;
    })();

    inFlightRequests.set(normalizedKeyword, payloadPromise);

    try {
      const payload = await payloadPromise;
      log("request_completed", {
        core: keyword,
        finalImageCount: payload.images.filter((image) => Boolean(image.url)).length,
        latencyMs: Date.now() - startedAt
      });

      return jsonResponse(payload, requestId);
    } finally {
      inFlightRequests.delete(normalizedKeyword);
    }
  } catch (caughtError) {
    if (caughtError instanceof UnsplashError) {
      if (caughtError.code === "no_results") {
        log("request_failed", {
          code: caughtError.code,
          core: requestedKeyword,
          latencyMs: Date.now() - startedAt,
          status: 404
        });
        return errorResponseWithRequestId(caughtError.message, 404, requestId);
      }

      if (caughtError.code === "missing_key") {
        log("request_failed", {
          code: caughtError.code,
          core: requestedKeyword,
          latencyMs: Date.now() - startedAt,
          status: 503
        });
        return errorResponseWithRequestId(
          "Image source is not configured on the server.",
          503,
          requestId
        );
      }

      if (caughtError.status === 429) {
        log("request_failed", {
          code: caughtError.code,
          core: requestedKeyword,
          latencyMs: Date.now() - startedAt,
          status: 429
        });
        return errorResponseWithRequestId(
          "Image search is temporarily rate limited. Try again shortly.",
          429,
          requestId,
          60
        );
      }

      log("request_failed", {
        code: caughtError.code,
        core: requestedKeyword,
        latencyMs: Date.now() - startedAt,
        status: caughtError.status
      });

      return errorResponseWithRequestId(
        "Image search failed while building this poster.",
        caughtError.status,
        requestId
      );
    }

    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to generate poster.";

    log("request_failed", {
      error: message,
      core: requestedKeyword,
      latencyMs: Date.now() - startedAt,
      status: 500
    });

    return errorResponseWithRequestId(message, 500, requestId);
  }
}
