"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
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
  onReadyChange: (ready: boolean) => void;
  poster: PosterPayload | null;
  posterRef: RefObject<HTMLDivElement | null>;
  shareHref: string;
  onCopyImage: () => void;
  onDownload: () => void;
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
  onReadyChange,
  poster,
  posterRef,
  shareHref,
  onCopyImage,
  onDownload
}: PosterGridProps) {
  const [loadedCount, setLoadedCount] = useState(0);
  const loadedImages = useRef(new Set<string>());
  const totalImages = useMemo(
    () => poster?.images.filter((image) => Boolean(image.url)).length ?? 0,
    [poster]
  );
  const isReady = !poster || totalImages === 0 || loadedCount >= totalImages;

  useEffect(() => {
    onReadyChange(isReady);
  }, [isReady, onReadyChange]);

  const handleImageLoad = (imageKey: string) => {
    if (loadedImages.current.has(imageKey)) {
      return;
    }

    loadedImages.current.add(imageKey);
    setLoadedCount((currentCount) => currentCount + 1);
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
        className="w-[90vw] max-w-xl rounded-3xl border border-zinc-800 bg-black/75 p-4 shadow-2xl backdrop-blur-sm sm:p-5"
      >
        <h2 className="mb-4 text-center text-lg font-semibold uppercase tracking-[0.25em] text-zinc-100">
          {poster?.title ?? "AESTHETIC IDENTITY"}
        </h2>

        <div className="grid grid-cols-3 gap-[2px] overflow-hidden rounded-[1.35rem] bg-zinc-900 p-[2px]">
          {gridItems.map((image, index) =>
            image.url ? (
              <div
                key={`${image.query}-${index}`}
                className={`relative aspect-square overflow-hidden bg-zinc-950 transition-opacity duration-700 ${
                  isLoading || !isReady ? "opacity-0" : "opacity-100"
                }`}
              >
                <Image
                  alt={image.query}
                  className="object-cover"
                  fill
                  onLoad={() => {
                    handleImageLoad(`${image.query}-${index}`);
                  }}
                  sizes="(max-width: 768px) 30vw, 220px"
                  src={image.url}
                />
              </div>
            ) : (
              <div
                key={`${image.query}-${index}`}
                className={`flex aspect-square items-center justify-center bg-zinc-900 px-3 text-center text-[10px] uppercase tracking-[0.25em] text-zinc-500 ${
                  isLoading ? "animate-pulse" : ""
                }`}
              >
                {poster ? fallbackLabel(image.query) : "□"}
              </div>
            )
          )}
        </div>

        <p className="mt-4 text-center text-xs uppercase tracking-wide text-zinc-400 opacity-70">
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
        <a
          aria-disabled={!canShare}
          className={`w-full rounded-full border px-5 py-2 text-center text-sm font-medium transition sm:w-auto ${
            canShare
              ? "border-zinc-700 text-zinc-100 hover:border-zinc-500 hover:bg-zinc-800"
              : "pointer-events-none border-zinc-800 text-zinc-500"
          }`}
          href={shareHref}
          rel="noreferrer"
          target="_blank"
        >
          Share on X
        </a>
      </div>
    </section>
  );
}
