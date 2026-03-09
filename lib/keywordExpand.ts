import { CORE_MAP } from "@/lib/coreDictionary";

const PRESET_KEYWORDS_MAP: Record<string, string[]> = {
  "berlin core": ["concrete", "nightlife", "transit", "gallery", "espresso"],
  "blonde core": ["gloss", "gold", "vanity", "lace", "sunlight"],
  "cafe core": ["espresso", "steam", "pastry", "ceramic", "warmth"],
  "cyberpunk core": ["neon", "chrome", "rain", "hologram", "megacity"],
  "film camera core": ["grain", "analog", "sepia", "projector", "nostalgia"],
  "korean core": ["ramen", "neon", "subway", "rain", "convenience"],
  "night city core": ["midnight", "neon", "subway", "rain", "rooftop"],
  "sad indie core": ["rain", "poetry", "cassette", "lamp", "midnight"],
  "startup core": ["hustle", "caffeine", "pitch", "screens", "deadline"],
  "tokyo core": ["neon", "alley", "ramen", "rain", "transit"]
};

const GENERIC_SCENES = [
  "street cinematic night",
  "moody film portrait",
  "interior aesthetic glow",
  "close up details film",
  "daily objects moody",
  "cafe moment cinematic",
  "fashion editorial night",
  "city atmosphere moody",
  "late night aesthetic"
];

const MODIFIER_TRAILS = [
  ["cinematic", "night"],
  ["moody", "film"],
  ["aesthetic", "night"],
  ["cinematic", "film"],
  ["moody", "aesthetic"],
  ["film", "night"],
  ["cinematic", "aesthetic"],
  ["moody", "night"],
  ["film", "aesthetic"]
];

const KEYWORD_STOP_WORDS = new Set([
  "aesthetic",
  "atmosphere",
  "city",
  "close",
  "core",
  "daily",
  "details",
  "editorial",
  "interior",
  "late",
  "lights",
  "moment",
  "mood",
  "night",
  "style",
  "up"
]);

function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function appendAestheticModifiers(query: string, index: number) {
  const existingWords = new Set(query.toLowerCase().split(/\s+/));
  const missingWords = MODIFIER_TRAILS[index % MODIFIER_TRAILS.length].filter(
    (word) => !existingWords.has(word)
  );

  if (missingWords.length === 0) {
    return query;
  }

  return `${query} ${missingWords.join(" ")}`;
}

export function formatPosterTitle(keyword: string) {
  return keyword.trim().toUpperCase();
}

export function expandKeyword(keyword: string) {
  const normalized = normalizeKeyword(keyword);
  const curatedQueries = CORE_MAP[normalized];

  if (curatedQueries) {
    return curatedQueries.map((query, index) =>
      appendAestheticModifiers(query, index)
    );
  }

  const base = normalized.replace(/\bcore\b/g, "").trim() || normalized;

  return GENERIC_SCENES.map((scene, index) =>
    appendAestheticModifiers(`${base} ${scene}`, index)
  );
}

export function extractPosterKeywords(keyword: string, queries: string[]) {
  const normalized = normalizeKeyword(keyword);
  const presetKeywords = PRESET_KEYWORDS_MAP[normalized];

  if (presetKeywords) {
    return presetKeywords;
  }

  const uniqueTokens = queries
    .flatMap((query) => query.split(/\s+/))
    .map((part) => part.toLowerCase().replace(/[^a-z0-9-]/g, ""))
    .filter((part) => part.length > 2)
    .filter((part) => !KEYWORD_STOP_WORDS.has(part))
    .filter((part, index, list) => list.indexOf(part) === index);

  const baseTokens = titleCase(keyword)
    .split(" ")
    .map((part) => part.toLowerCase())
    .filter((part) => part !== "core");

  const keywords = uniqueTokens.filter((part) => !baseTokens.includes(part)).slice(0, 5);

  if (keywords.length === 5) {
    return keywords;
  }

  const fallbackBase = baseTokens[0] ?? "mood";

  return [...keywords, fallbackBase, "texture", "objects", "dreamy", "scene"].slice(0, 5);
}
