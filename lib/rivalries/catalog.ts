export const AVATARS = [
  ["raccoon", "Bandit"],
  ["fox", "Hustler"],
  ["bull", "Bullseye"],
  ["owl", "Night Shift"],
  ["robot", "Machine"],
  ["skeleton", "Deadeye"],
  ["badger", "Scrapper"],
  ["panther", "Closer"],
  ["bear", "Heavy Hitter"],
  ["crocodile", "Snap"],
  ["octopus", "Eight Arms"],
  ["rabbit", "Quickdraw"],
  ["wolf", "Fang"],
  ["red-panda", "Wildcard"],
  ["eagle", "High Flyer"],
  ["pig", "Road Hog"],
  ["alien", "Anomaly"],
  ["shark", "Finisher"],
  ["tiger", "Triple Threat"],
  ["bulldog", "Brawler"],
  ["penguin", "Ice Cold"],
  ["lion", "Crown"],
  ["tortoise", "Slow Burn"],
  ["cat", "Nine Lives"],
].map(([id, label]) => ({
  id,
  label,
  image: `/avatars/${id}.webp`,
  medium: `/avatars/${id}-256.webp`,
  thumbnail: `/avatars/${id}-96.webp`,
}));
export const avatarById = (id: string | null | undefined) =>
  AVATARS.find((a) => a.id === id);
export function initials(name: string) {
  return (
    Array.from(
      name
        .replace(/\([^)]*\)/g, " ")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => Array.from(w)[0] ?? "")
        .join(""),
    )
      .join("")
      .toLocaleUpperCase() || "?"
  );
}
