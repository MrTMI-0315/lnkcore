"use client";

import Image from "next/image";
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
  poster,
  posterRef,
  shareHref,
  onCopyLink,
  onDownload
}: PosterGridProps) {
  return (
    <section
      className={`w-[90vw] max-w-xl transition-all duration-700 ${
        isLoading ? "opacity-70" : "opacity-100"
      }`}
    >
      <div
        ref={posterRef}
        className="rounded-[2rem] border border-white/10 bg-[#050505] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.55)]"
      >
        <p className="mb-3 text-center text-[10px] uppercase tracking-[0.45em] text-white/45">
          identity poster
        </p>
        <h2 className="mb-5 text-center text-3xl font-semibold uppercase tracking-[0.3em] text-white sm:text-4xl">
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

        <p className="mt-5 text-center text-sm uppercase tracking-[0.3em] text-white/65 sm:text-base">
          {poster.keywords.join(" / ")}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          className="rounded-full border border-white/15 bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
          type="button"
          onClick={onDownload}
        >
          Download Poster
        </button>
        <button
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/8"
          type="button"
          onClick={onCopyLink}
        >
          {copied ? "Link Copied" : "Copy Link"}
        </button>
        <a
          className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/8"
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
