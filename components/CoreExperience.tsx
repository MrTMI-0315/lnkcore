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
const UNSPLASH_FALLBACK_MESSAGE =
  "Couldn't find images for this core. Try another keyword.";

type CoreExperienceProps = {
  initialKeyword?: string;
};

function buildShareUrl(url: string) {
  const shareUrl = new URL("https://twitter.com/intent/tweet");
  shareUrl.searchParams.set("text", SHARE_TEXT);

  if (url) {
    shareUrl.searchParams.set("url", url);
  }

  return shareUrl.toString();
}

export function CoreExperience({ initialKeyword }: CoreExperienceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [poster, setPoster] = useState<PosterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPosterReady, setIsPosterReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);

  const isBusy = isGenerating || (Boolean(poster) && !isPosterReady);
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

    setError(null);
    setCopied(false);
    setIsPosterReady(false);
    setIsGenerating(true);

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

      startTransition(() => {
        setPoster(data);
        setKeyword(trimmedKeyword);
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : UNSPLASH_FALLBACK_MESSAGE;

      setPoster(null);
      setError(message);
    } finally {
      setIsGenerating(false);
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
      const slug = keywordToSlug(trimmedKeyword);
      const targetPath = `/core/${slug}`;

      if (pathname === targetPath) {
        void fetchPoster(trimmedKeyword);
        return;
      }

      setPoster(null);
      setError(null);
      setIsPosterReady(false);
      setIsGenerating(true);
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
      return;
    }

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
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!pageUrl) {
      return;
    }

    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
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

  useEffect(() => {
    syncPageUrl();
  }, [pathname, syncPageUrl]);

  useEffect(() => {
    if (!initialKeyword) {
      setIsGenerating(false);
      return;
    }

    setKeyword(initialKeyword);
    void fetchPoster(initialKeyword);
  }, [fetchPoster, initialKeyword]);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopied(false);
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copied]);

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.08),_transparent_32%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col items-center justify-center gap-8 sm:gap-10">
        <section className="flex max-w-3xl flex-col items-center gap-4 text-center">
          <p className="text-xs uppercase tracking-[0.45em] text-white/40">
            aesthetic identity poster
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-7xl">
            lnkCore
          </h1>
          <p className="max-w-xl text-base text-white/65 sm:text-lg">
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

        <div className="flex min-h-9 items-center justify-center text-center text-sm uppercase tracking-[0.3em] text-white/55">
          {isBusy ? "Generating aesthetic..." : null}
        </div>

        {error ? (
          <div className="flex w-[90vw] max-w-xl flex-col items-center gap-4 rounded-[2rem] border border-white/10 bg-white/[0.04] px-6 py-8 text-center">
            <p className="text-sm uppercase tracking-[0.3em] text-white/75">
              {error}
            </p>
            <button
              className="rounded-full border border-white/15 px-5 py-2 text-sm font-medium text-white transition hover:border-white/35 hover:bg-white/8"
              type="button"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        ) : null}

        {poster ? (
          <PosterGrid
            key={`${poster.title}-${poster.queries.join("|")}`}
            copied={copied}
            isLoading={isBusy}
            poster={poster}
            posterRef={posterRef}
            shareHref={buildShareUrl(pageUrl)}
            onCopyLink={handleCopyLink}
            onDownload={handleDownload}
            onReadyChange={setIsPosterReady}
          />
        ) : (
          !error &&
          !isBusy && (
            <div className="flex w-[90vw] max-w-xl flex-col items-center justify-center gap-4 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-8 py-16 text-center text-sm uppercase tracking-[0.35em] text-white/35">
              <p>Title</p>
              <p>3x3 image grid</p>
              <p>keywords</p>
            </div>
          )
        )}
      </div>
    </main>
  );
}
