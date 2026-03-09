export const CORES = [
  "Korean Core",
  "Berlin Core",
  "Tokyo Core",
  "Startup Core",
  "Sad Indie Core",
  "Cafe Core",
  "Night City Core",
  "Vintage Film Core",
  "Cyberpunk Core"
] as const;

export const EXAMPLE_CORES = [
  "Korean Core",
  "Berlin Core",
  "Sad Indie Core",
  "Startup Core",
  "Cafe Core"
] as const;

const KNOWN_SLUGS = new Map(
  CORES.map((core) => [keywordToSlug(core), core])
);

export function normalizeKeyword(keyword: string) {
  return keyword.trim().toLowerCase();
}

export function keywordToSlug(keyword: string) {
  return normalizeKeyword(keyword)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugToKeyword(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  const knownKeyword = KNOWN_SLUGS.get(normalizedSlug);

  if (knownKeyword) {
    return knownKeyword;
  }

  return normalizedSlug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
