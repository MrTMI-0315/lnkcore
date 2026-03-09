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
  copied: boolean;
  isLoading: boolean;
  onReadyChange: (ready: boolean) => void;
  poster: PosterPayload;
  posterRef: RefObject<HTMLDivElement | null>;
  shareHref: string;
  onCopyLink: () => void;
  onDownload: () => void;
};

function fallbackLabel(query: string) {
  return query
    .split(" ")
    .slice(0, 2)
    .join(" ");
}

export function PosterGrid({
  copied,
  isLoading,
  onReadyChange,
  poster,
  posterRef,
  shareHref,
  onCopyLink,
  onDownload
}: PosterGridProps) {
  const [loadedCount, setLoadedCount] = useState(0);
  const loadedImages = useRef(new Set<string>());
  const totalImages = useMemo(
    () => poster.images.filter((image) => Boolean(image.url)).length,
    [poster.images]
  );
  const isReady = totalImages === 0 || loadedCount >= totalImages;

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

  return (
    <section
      className={`mx-auto w-[90vw] max-w-xl transition-all duration-700 ${
        isLoading || !isReady ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div
        ref={posterRef}
        className="rounded-[2rem] border border-white/10 bg-[#050505] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
      >
        <h2 className="mb-5 text-center text-3xl font-semibold uppercase tracking-[0.35em] text-white sm:text-4xl">
          {poster.title}
        </h2>

        <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-[1.5rem] bg-white/6 p-1">
          {poster.images.map((image, index) =>
            image.url ? (
              <div
                key={`${image.query}-${index}`}
                className="relative aspect-square overflow-hidden"
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
                className="flex aspect-square items-center justify-center bg-white/[0.06] px-3 text-center text-[10px] uppercase tracking-[0.25em] text-white/35"
              >
                {fallbackLabel(image.query)}
              </div>
            )
          )}
        </div>

        <p className="mt-5 text-center text-xs uppercase tracking-[0.28em] text-white/80 sm:text-sm">
          {poster.keywords.join(" • ")}
        </p>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          className="w-full rounded-full border border-white/15 bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90 sm:w-auto"
          type="button"
          onClick={onDownload}
        >
          Download Poster
        </button>
        <button
          className="w-full rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/8 sm:w-auto"
          type="button"
          onClick={onCopyLink}
        >
          {copied ? "Link Copied" : "Copy Link"}
        </button>
        <a
          className="w-full rounded-full border border-white/15 px-5 py-2 text-center text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/8 sm:w-auto"
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
