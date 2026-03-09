"use client";

import html2canvas from "html2canvas";
import { usePathname, useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import { PosterGrid, type PosterPayload } from "@/components/PosterGrid";
import { SearchInput } from "@/components/SearchInput";
import { CORES, EXAMPLE_CORES, keywordToSlug, normalizeKeyword } from "@/lib/cores";

const SHARE_TEXT = "Check out my aesthetic core poster";
const UNSPLASH_FALLBACK_MESSAGE = "Couldn't find images for this core.";
const POPULAR_PRELOAD_CORES = ["tokyo core", "seoul core", "cafe core"] as const;
const STATUS_LABELS = {
  building: "Building your core...",
  curating: "Curating images...",
  idle: "tumblr moodboard generator",
  searching: "Searching aesthetic..."
} as const;

type LoadingStage = keyof typeof STATUS_LABELS;

type CoreExperienceProps = {
  initialKeyword?: string;
};

const clientPosterCache = new Map<string, PosterPayload>();
let popularCoresPreloaded = false;

function buildShareUrl(url: string) {
  const shareUrl = new URL("https://twitter.com/intent/tweet");
  shareUrl.searchParams.set("text", SHARE_TEXT);

  if (url) {
    shareUrl.searchParams.set("url", url);
  }

  return shareUrl.toString();
}

function buildPlaceholderKeywords(keyword: string) {
  const tokens = keyword
    .split(/\s+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token && token !== "core")
    .slice(0, 2);

  return [...tokens, "mood", "poster", "aesthetic"].slice(0, 5);
}

function buildPlaceholderPoster(keyword: string): PosterPayload {
  return {
    title: keyword.trim().toUpperCase(),
    queries: Array.from({ length: 9 }, (_, index) => `placeholder-${index + 1}`),
    keywords: buildPlaceholderKeywords(keyword),
    images: Array.from({ length: 9 }, (_, index) => ({
      query: `placeholder-${index + 1}`,
      url: null
    }))
  };
}

export function CoreExperience({ initialKeyword }: CoreExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [poster, setPoster] = useState<PosterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingPoster, setIsFetchingPoster] = useState(false);
  const [isPosterReady, setIsPosterReady] = useState(false);
  const [hasResolvedImages, setHasResolvedImages] = useState(false);
  const [loadingStage, setLoadingStage] = useState<LoadingStage>("idle");
  const [actionToast, setActionToast] = useState<string | null>(null);
  const [copiedImage, setCopiedImage] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);

  const isBusy = isFetchingPoster || (hasResolvedImages && !isPosterReady);
  const normalizedInitialKeyword = useMemo(
    () => normalizeKeyword(initialKeyword ?? ""),
    [initialKeyword]
  );

  const syncPageUrl = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    setPageUrl(window.location.href);
  }, []);

  const fetchPoster = useCallback(async (nextKeyword: string) => {
    const trimmedKeyword = nextKeyword.trim();

    if (!trimmedKeyword) {
      setPoster(null);
      setError("Type a core keyword first.");
      return;
    }

    const normalizedKeyword = normalizeKeyword(trimmedKeyword);

    setError(null);
    setCopiedImage(false);
    setActionToast(null);
    setPoster(buildPlaceholderPoster(trimmedKeyword));
    setHasResolvedImages(false);
    setIsPosterReady(false);
    setIsFetchingPoster(true);
    setLoadingStage("searching");

    const cachedPoster = clientPosterCache.get(normalizedKeyword);

    if (cachedPoster) {
      setPoster(cachedPoster);
      setKeyword(trimmedKeyword);
      setHasResolvedImages(true);
      setIsFetchingPoster(false);
      setLoadingStage("curating");
      return;
    }

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keyword: trimmedKeyword
        })
      });

      const data = (await response.json()) as PosterPayload & {
        error?: string;
      };

      if (!response.ok) {
        const message =
          response.status >= 500 || response.status === 429
            ? UNSPLASH_FALLBACK_MESSAGE
            : data.error ?? UNSPLASH_FALLBACK_MESSAGE;

        throw new Error(message);
      }

      clientPosterCache.set(normalizedKeyword, data);

      startTransition(() => {
        setPoster(data);
        setKeyword(trimmedKeyword);
        setHasResolvedImages(true);
        setLoadingStage("curating");
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : UNSPLASH_FALLBACK_MESSAGE;

      setError(message);
      setHasResolvedImages(false);
      setLoadingStage("idle");
    } finally {
      setIsFetchingPoster(false);
    }
  }, []);

  const navigateToCore = useCallback(
    (nextKeyword: string) => {
      const trimmedKeyword = nextKeyword.trim();

      if (!trimmedKeyword) {
        setError("Type a core keyword first.");
        return;
      }

      setKeyword(trimmedKeyword);
      setPoster(buildPlaceholderPoster(trimmedKeyword));
      setHasResolvedImages(false);
      setIsPosterReady(false);
      setIsFetchingPoster(true);
      setLoadingStage("searching");
      setError(null);

      const slug = keywordToSlug(trimmedKeyword);
      const targetPath = `/core/${slug}`;

      if (pathname === targetPath) {
        void fetchPoster(trimmedKeyword);
        return;
      }

      router.push(targetPath);
    },
    [fetchPoster, pathname, router]
  );

  const handleRandomCore = useCallback(() => {
    const nextKeyword = CORES[Math.floor(Math.random() * CORES.length)];
    navigateToCore(nextKeyword);
  }, [navigateToCore]);

  const handleDownload = useCallback(async () => {
    if (!posterRef.current) {
      setActionToast("Poster is still loading.");
      return;
    }

    try {
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: "#050505",
        scale: 2,
        useCORS: true,
        logging: false
      });

      const link = document.createElement("a");
      link.download = "core-poster.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      setActionToast("Saved aesthetic poster.");
    } catch {
      setActionToast("Unable to save poster. Try again.");
    }
  }, []);

  const handleCopyImage = useCallback(async () => {
    if (!posterRef.current || typeof window === "undefined") {
      setActionToast("Poster is still loading.");
      return;
    }

    try {
      const canvas = await html2canvas(posterRef.current, {
        backgroundColor: "#050505",
        scale: 2,
        useCORS: true,
        logging: false
      });

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/png");
      });

      if (!blob || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Clipboard image copy is unavailable.");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);
      setCopiedImage(true);
      setActionToast("Copied poster image.");
    } catch {
      setActionToast("Copy image is unavailable on this browser. Download the poster instead.");
    }
  }, []);

  const handleShare = useCallback(() => {
    if (typeof window === "undefined" || !pageUrl) {
      setActionToast("Share link is not ready yet.");
      return;
    }

    try {
      const shareWindow = window.open(
        buildShareUrl(pageUrl),
        "_blank",
        "noopener,noreferrer"
      );

      if (!shareWindow) {
        throw new Error("share_window_blocked");
      }
    } catch {
      setActionToast("Unable to open share window. Allow pop-ups and try again.");
    }
  }, [pageUrl]);

  const handleRetry = useCallback(() => {
    const targetKeyword = keyword.trim() || initialKeyword?.trim();

    if (!targetKeyword) {
      return;
    }

    if (normalizeKeyword(targetKeyword) === normalizedInitialKeyword) {
      void fetchPoster(targetKeyword);
      return;
    }

    navigateToCore(targetKeyword);
  }, [fetchPoster, initialKeyword, keyword, navigateToCore, normalizedInitialKeyword]);

  const handlePosterProgress = useCallback(
    (loaded: number, total: number) => {
      if (!hasResolvedImages) {
        setIsPosterReady(false);
        return;
      }

      if (total === 0) {
        setIsPosterReady(true);
        setLoadingStage("idle");
        return;
      }

      if (loaded === 0) {
        setIsPosterReady(false);
        setLoadingStage("curating");
        return;
      }

      if (loaded < total) {
        setIsPosterReady(false);
        setLoadingStage("building");
        return;
      }

      setIsPosterReady(true);
      setLoadingStage("idle");
    },
    [hasResolvedImages]
  );

  useEffect(() => {
    syncPageUrl();
  }, [pathname, syncPageUrl]);

  useEffect(() => {
    if (!initialKeyword) {
      setIsFetchingPoster(false);
      setLoadingStage("idle");
      return;
    }

    setKeyword(initialKeyword);
    void fetchPoster(initialKeyword);
  }, [fetchPoster, initialKeyword]);

  useEffect(() => {
    if (!copiedImage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopiedImage(false);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copiedImage]);

  useEffect(() => {
    if (!actionToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActionToast(null);
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [actionToast]);

  useEffect(() => {
    if (popularCoresPreloaded || typeof window === "undefined") {
      return;
    }

    popularCoresPreloaded = true;

    const timeoutId = window.setTimeout(() => {
      void Promise.all(
        POPULAR_PRELOAD_CORES.map(async (coreKeyword) => {
          if (clientPosterCache.has(coreKeyword)) {
            return;
          }

          try {
            const response = await fetch("/api/generate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                keyword: coreKeyword
              })
            });

            if (!response.ok) {
              return;
            }

            const data = (await response.json()) as PosterPayload;
            clientPosterCache.set(coreKeyword, data);
          } catch {
            return;
          }
        })
      );
    }, 1200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(24,24,27,0.96),_rgba(0,0,0,0.98)_44%,_#000_82%)] px-4 py-10 text-white">
      <div className="grain-overlay pointer-events-none absolute inset-0 opacity-30" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_22%),radial-gradient(circle_at_bottom,_rgba(113,113,122,0.1),_transparent_30%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center gap-6 sm:gap-8">
        <section className="flex max-w-3xl flex-col items-center gap-3 text-center">
          <p className="text-xs uppercase tracking-[0.45em] text-zinc-500">
            aesthetic identity poster
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            lnkCore
          </h1>
          <p className="max-w-xl text-base text-zinc-400 sm:text-lg">
            generate your aesthetic identity
          </p>
        </section>

        <SearchInput
          examples={EXAMPLE_CORES}
          isLoading={isBusy}
          value={keyword}
          onChange={setKeyword}
          onExampleClick={navigateToCore}
          onGenerate={() => {
            navigateToCore(keyword);
          }}
          onRandom={handleRandomCore}
        />

        <div className="flex min-h-8 items-center justify-center text-center text-xs uppercase tracking-[0.32em] text-zinc-500">
          {STATUS_LABELS[loadingStage]}
        </div>

        <PosterGrid
          key={poster ? `${poster.title}-${poster.queries.join("|")}` : "poster-placeholder"}
          canShare={Boolean(poster) && hasResolvedImages && isPosterReady && !isFetchingPoster}
          copiedImage={copiedImage}
          isLoading={isBusy}
          onProgressChange={handlePosterProgress}
          poster={poster}
          posterRef={posterRef}
          onCopyImage={handleCopyImage}
          onDownload={handleDownload}
          onShare={handleShare}
        />

        {error ? (
          <div className="flex w-[90vw] max-w-xl flex-col items-center gap-4 rounded-3xl border border-zinc-800 bg-zinc-950/70 px-6 py-6 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-zinc-300">
              {error}
            </p>
            <button
              className="rounded-full border border-zinc-700 px-5 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500 hover:bg-zinc-800"
              type="button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>

      <div
        className={`pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-950/95 px-4 py-2 text-xs uppercase tracking-[0.25em] text-zinc-100 shadow-[0_12px_30px_rgba(0,0,0,0.45)] transition-all duration-300 ${
          actionToast
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0"
        }`}
      >
        {actionToast ?? ""}
      </div>
    </main>
  );
}
