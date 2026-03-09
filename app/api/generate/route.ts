import { NextResponse } from "next/server";

import { expandKeyword, extractPosterKeywords, formatPosterTitle } from "@/lib/keywordExpand";
import { searchImage, UnsplashError } from "@/lib/unsplash";

export const runtime = "nodejs";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 8;

const requestCounts = new Map<string, { count: number; resetAt: number }>();

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

    const queries = expandKeyword(keyword);
    const keywords = extractPosterKeywords(keyword, queries);

    const images = await Promise.all(
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

    if (images.every((image) => !image.url)) {
      return errorResponse(
        "We could not build this poster right now. Try another core in a moment.",
        502
      );
    }

    return NextResponse.json({
      title: formatPosterTitle(keyword),
      queries,
      keywords,
      images
    });
  } catch (caughtError) {
    if (caughtError instanceof UnsplashError) {
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
