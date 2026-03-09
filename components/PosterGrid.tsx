"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { RefObject } from "react";

export type PosterPayload = {
  title: string;
  queries: string[];
  keywords: string[];
  images: Array<{
    query: string;
    url: string | null;
  }>;
};

type PosterGridProps = {
  canShare: boolean;
  copiedImage: boolean;
  isLoading: boolean;
  onProgressChange: (loaded: number, total: number) => void;
  poster: PosterPayload | null;
  posterRef: RefObject<HTMLDivElement | null>;
  onCopyImage: () => void;
  onDownload: () => void;
  onShare: () => void;
};

function fallbackLabel(query: string) {
  return query
    .split(" ")
    .slice(0, 2)
    .join(" ");
}

const PLACEHOLDER_KEYWORDS = [
  "mood",
  "collage",
  "poster",
  "identity",
  "dreamscape"
];

export function PosterGrid({
  canShare,
  copiedImage,
  isLoading,
  onProgressChange,
  poster,
  posterRef,
  onCopyImage,
  onDownload,
  onShare
}: PosterGridProps) {
  const [loadedImages, setLoadedImages] = useState<Record<string, true>>({});
  const totalImages = useMemo(
    () => poster?.images.filter((image) => Boolean(image.url)).length ?? 0,
    [poster]
  );
  const loadedCount = Object.keys(loadedImages).length;

  useEffect(() => {
    onProgressChange(loadedCount, totalImages);
  }, [loadedCount, onProgressChange, totalImages]);

  const handleImageLoad = (imageKey: string) => {
    setLoadedImages((currentLoadedImages) => {
      if (currentLoadedImages[imageKey]) {
        return currentLoadedImages;
      }

      return {
        ...currentLoadedImages,
        [imageKey]: true
      };
    });
  };

  const gridItems =
    poster?.images ??
    Array.from({ length: 9 }, (_, index) => ({
      query: `placeholder-${index}`,
      url: null
    }));

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col items-center gap-4">
      <div
        ref={posterRef}
        className="w-[90vw] max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl shadow-[0_0_40px_rgba(0,0,0,0.6)] transition-shadow duration-300 hover:shadow-[0_0_56px_rgba(0,0,0,0.72)] sm:p-5"
      >
        <h2 className="mb-4 text-center text-xl font-semibold uppercase tracking-[0.35em] text-zinc-100">
          {poster?.title ?? "AESTHETIC IDENTITY"}
        </h2>

        <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[1.35rem] bg-zinc-900 p-[2px]">
          {gridItems.map((image, index) => {
            const imageKey = `${image.query}-${index}`;
            const hasLoaded = Boolean(loadedImages[imageKey]);

            if (image.url) {
              return (
                <div
                  key={imageKey}
                  className="group relative aspect-square overflow-hidden border border-zinc-800 bg-zinc-950"
                >
                  {!hasLoaded ? (
                    <div className="absolute inset-0 animate-pulse bg-zinc-800" />
                  ) : null}
                  <Image
                    alt={image.query}
                    className={`h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
                      hasLoaded ? "opacity-100" : "opacity-0"
                    }`}
                    fill
                    onLoad={() => {
                      handleImageLoad(imageKey);
                    }}
                    sizes="(max-width: 768px) 30vw, 220px"
                    src={image.url}
                  />
                </div>
              );
            }

            return (
              <div
                key={imageKey}
                className={`flex aspect-square items-center justify-center border border-zinc-800 px-3 text-center uppercase ${
                  isLoading
                    ? "animate-pulse bg-zinc-900 text-zinc-500"
                    : "bg-[radial-gradient(circle_at_top,_rgba(63,63,70,0.28),_rgba(24,24,27,0.92)_58%,_rgba(9,9,11,1)_100%)] text-zinc-300"
                }`}
              >
                {poster ? (
                  <div className="flex flex-col items-center gap-2">
                    {!isLoading ? (
                      <span className="text-[8px] tracking-[0.35em] text-zinc-600">
                        CURATED
                      </span>
                    ) : null}
                    <span className="text-[10px] tracking-[0.25em]">
                      {fallbackLabel(image.query)}
                    </span>
                  </div>
                ) : (
                  ""
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-center text-xs uppercase tracking-wide text-zinc-400 opacity-60">
          {(poster?.keywords ?? PLACEHOLDER_KEYWORDS).join(" • ")}
        </p>
      </div>

      <div className="flex w-[90vw] max-w-xl flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          className="w-full rounded-full border border-zinc-200 bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-500 sm:w-auto"
          disabled={!canShare}
          type="button"
          onClick={onDownload}
        >
          Download Poster
        </button>
        <button
          className="w-full rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-500 sm:w-auto"
          disabled={!canShare}
          type="button"
          onClick={onCopyImage}
        >
          {copiedImage ? "Image Copied" : "Copy Image"}
        </button>
        <button
          aria-disabled={!canShare}
          className={`w-full rounded-full border px-5 py-2 text-center text-sm font-medium transition sm:w-auto ${
            canShare
              ? "border-zinc-700 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
              : "pointer-events-none border-zinc-800 text-zinc-500"
          }`}
          disabled={!canShare}
          type="button"
          onClick={onShare}
        >
          Share on X
        </button>
      </div>
    </section>
  );
}
