import { NextResponse } from "next/server";

import { expandKeyword, extractPosterKeywords, formatPosterTitle } from "@/lib/keywordExpand";
import { searchImage } from "@/lib/unsplash";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      keyword?: string;
    };

    const keyword = body.keyword?.trim();

    if (!keyword || keyword.length > 80) {
      return NextResponse.json(
        {
          error: "Enter a keyword between 1 and 80 characters."
        },
        {
          status: 400
        }
      );
    }

    const queries = expandKeyword(keyword);
    const keywords = extractPosterKeywords(keyword, queries);

    const images = await Promise.all(
      queries.map(async (query) => ({
        query,
        url: await searchImage(query)
      }))
    );

    if (images.every((image) => !image.url)) {
      return NextResponse.json(
        {
          error: "Unsplash did not return any images for this core."
        },
        {
          status: 502
        }
      );
    }

    return NextResponse.json({
      title: formatPosterTitle(keyword),
      queries,
      keywords,
      images
    });
  } catch (caughtError) {
    const message =
      caughtError instanceof Error
        ? caughtError.message
        : "Unable to generate poster.";

    return NextResponse.json(
      {
        error: message
      },
      {
        status: 500
      }
    );
  }
}
