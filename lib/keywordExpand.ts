type PresetConfig = {
  keywords: string[];
  queries: string[];
};

const PRESET_MAP: Record<string, PresetConfig> = {
  "berlin core": {
    queries: [
      "berlin brutalist architecture",
      "berlin underground club",
      "berlin tram window",
      "berlin coffee table",
      "berlin gallery wall",
      "berlin rain street",
      "berlin analog camera",
      "berlin apartment interior",
      "berlin night city"
    ],
    keywords: ["concrete", "nightlife", "transit", "gallery", "espresso"]
  },
  "blonde core": {
    queries: [
      "blonde fashion editorial",
      "golden makeup vanity",
      "cream bedroom aesthetic",
      "sunlit mirror selfie",
      "glossy magazine stack",
      "lace top detail",
      "soft gold jewelry",
      "candlelit apartment",
      "champagne coupe"
    ],
    keywords: ["gloss", "gold", "vanity", "lace", "sunlight"]
  },
  "cafe core": {
    queries: [
      "espresso crema close up",
      "cafe window rain",
      "wood table pastry",
      "coffee grinder detail",
      "ceramic mug steam",
      "notebook beside latte",
      "warm lamp cafe",
      "barista counter aesthetic",
      "vintage cafe chair"
    ],
    keywords: ["espresso", "steam", "pastry", "ceramic", "warmth"]
  },
  "cyberpunk core": {
    queries: [
      "cyberpunk neon alley",
      "hologram billboard city",
      "rainy futuristic street",
      "chrome fashion editorial",
      "glowing arcade machine",
      "night train platform neon",
      "cyberpunk motorcycle city",
      "purple blue city lights",
      "high rise megacity night"
    ],
    keywords: ["neon", "chrome", "rain", "hologram", "megacity"]
  },
  "film camera core": {
    queries: [
      "35mm film strip",
      "film camera close up",
      "dusty projector light",
      "retro photo booth",
      "analog portrait grain",
      "warm sepia street",
      "vintage cinema chair",
      "old magazine collage",
      "sun flare photograph"
    ],
    keywords: ["grain", "analog", "sepia", "projector", "nostalgia"]
  },
  "korean core": {
    queries: [
      "korean street",
      "ramen",
      "korean neon sign",
      "subway korea",
      "soju bottle",
      "convenience store korea",
      "rainy street korea",
      "apartment balcony korea",
      "night city korea"
    ],
    keywords: ["ramen", "neon", "subway", "rain", "convenience"]
  },
  "night city core": {
    queries: [
      "night city skyline",
      "rain on taxi window",
      "neon crosswalk night",
      "late subway platform",
      "apartment window city",
      "downtown convenience light",
      "street reflections rain",
      "midnight rooftop view",
      "empty avenue night"
    ],
    keywords: ["midnight", "neon", "subway", "rain", "rooftop"]
  },
  "sad indie core": {
    queries: [
      "rain on train window",
      "cassette player close up",
      "dim bedroom lamp",
      "messy notebook poetry",
      "empty cafe table rain",
      "vintage headphones",
      "guitar in apartment corner",
      "night bus seat",
      "worn paperback book"
    ],
    keywords: ["rain", "poetry", "cassette", "lamp", "midnight"]
  },
  "startup core": {
    queries: [
      "founder desk setup",
      "laptop code dark room",
      "whiteboard product sprint",
      "pitch deck close up",
      "coffee cup keyboard",
      "city coworking space",
      "late night office",
      "iphone notes app",
      "glass meeting room"
    ],
    keywords: ["hustle", "caffeine", "pitch", "screens", "deadline"]
  },
  "tokyo core": {
    queries: [
      "tokyo neon alley",
      "tokyo vending machine",
      "shibuya crossing night",
      "tokyo ramen counter",
      "japanese train interior",
      "tokyo apartment balcony",
      "rainy street tokyo",
      "tokyo convenience store",
      "tokyo skyline dusk"
    ],
    keywords: ["neon", "alley", "ramen", "rain", "transit"]
  }
};

const GENERIC_SCENES = [
  "street style",
  "night lights",
  "interior mood",
  "close up details",
  "daily objects",
  "cafe moment",
  "fashion editorial",
  "city atmosphere",
  "late night"
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

export function formatPosterTitle(keyword: string) {
  return keyword.trim().toUpperCase();
}

export function expandKeyword(keyword: string) {
  const normalized = normalizeKeyword(keyword);
  const preset = PRESET_MAP[normalized];

  if (preset) {
    return preset.queries;
  }

  const base = normalized.replace(/\bcore\b/g, "").trim() || normalized;

  return GENERIC_SCENES.map((scene) => `${base} ${scene}`);
}

export function extractPosterKeywords(keyword: string, queries: string[]) {
  const normalized = normalizeKeyword(keyword);
  const preset = PRESET_MAP[normalized];

  if (preset) {
    return preset.keywords;
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
