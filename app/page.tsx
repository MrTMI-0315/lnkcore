"use client";

import html2canvas from "html2canvas";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import { PosterGrid, type PosterPayload } from "@/components/PosterGrid";
import { SearchInput } from "@/components/SearchInput";

const EXAMPLES = [
  "Korean Core",
  "Berlin Core",
  "Sad Indie Core",
  "Startup Core"
];

const RANDOM_CORES = [
  "Korean Core",
  "Berlin Core",
  "Startup Core",
  "Tokyo Core",
  "Cafe Core"
];

const SHARE_TEXT = "Check out my aesthetic core poster";

function buildShareUrl(url: string) {
  const shareUrl = new URL("https://twitter.com/intent/tweet");
  shareUrl.searchParams.set("text", SHARE_TEXT);

  if (url) {
    shareUrl.searchParams.set("url", url);
  }

  return shareUrl.toString();
}

export default function Home() {
  const [keyword, setKeyword] = useState("");
  const [poster, setPoster] = useState<PosterPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState("");
  const posterRef = useRef<HTMLDivElement>(null);
  const sharedCoreHandled = useRef(false);

  const generatePoster = useCallback(
    async (nextKeyword = keyword) => {
      const trimmedKeyword = nextKeyword.trim();

      if (!trimmedKeyword) {
        setError("Type a core keyword first.");
        return;
      }

      setError(null);
      setCopied(false);
      setIsGenerating(true);

      if (typeof window !== "undefined") {
        const current = new URL(window.location.href);
        current.searchParams.set("core", trimmedKeyword);
        window.history.replaceState({}, "", current.toString());
        setPageUrl(current.toString());
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
          throw new Error(data.error ?? "Unable to generate poster.");
        }

        startTransition(() => {
          setKeyword(trimmedKeyword);
          setPoster(data);
        });
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to generate poster.";

        setError(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [keyword]
  );

  const handleRandomCore = async () => {
    const nextKeyword =
      RANDOM_CORES[Math.floor(Math.random() * RANDOM_CORES.length)];

    setKeyword(nextKeyword);
    await generatePoster(nextKeyword);
  };

  const handleDownload = async () => {
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
  };

  const handleCopyLink = async () => {
    if (!pageUrl) {
      return;
    }

    await navigator.clipboard.writeText(pageUrl);
    setCopied(true);
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (sharedCoreHandled.current) {
      return;
    }

    sharedCoreHandled.current = true;

    const current = new URL(window.location.href);
    const sharedCore = current.searchParams.get("core");

    setPageUrl(current.toString());

    if (!sharedCore) {
      return;
    }

    setKeyword(sharedCore);
    void generatePoster(sharedCore);
  }, [generatePoster]);

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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_32%),radial-gradient(circle_at_bottom,_rgba(255,255,255,0.08),_transparent_28%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl flex-col items-center justify-center gap-10">
        <section className="flex max-w-3xl flex-col items-center gap-4 text-center">
          <p className="text-xs uppercase tracking-[0.45em] text-white/45">
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
          examples={EXAMPLES}
          isLoading={isGenerating}
          value={keyword}
          onChange={setKeyword}
          onExampleClick={setKeyword}
          onGenerate={() => generatePoster()}
          onRandom={handleRandomCore}
        />

        <div className="flex min-h-8 items-center justify-center text-sm uppercase tracking-[0.3em] text-white/55">
          {isGenerating ? "Generating aesthetic..." : error}
        </div>

        {poster ? (
          <PosterGrid
            copied={copied}
            isLoading={isGenerating}
            poster={poster}
            posterRef={posterRef}
            shareHref={buildShareUrl(pageUrl)}
            onCopyLink={handleCopyLink}
            onDownload={handleDownload}
          />
        ) : (
          <div className="flex w-[90vw] max-w-xl flex-col items-center justify-center gap-4 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-8 py-16 text-center text-sm uppercase tracking-[0.35em] text-white/35">
            <p>Title</p>
            <p>3x3 image grid</p>
            <p>keywords</p>
          </div>
        )}
      </div>
    </main>
  );
}
