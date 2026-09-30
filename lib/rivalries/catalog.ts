export const AVATARS = [
  ["raccoon", "The Bandit"],
  ["fox", "The Fox"],
  ["bull", "The Bull"],
  ["owl", "The Night Owl"],
  ["robot", "The Machine"],
  ["skeleton", "Deadeye"],
  ["badger", "The Badger"],
  ["panther", "The Panther"],
  ["bear", "The Bear"],
  ["crocodile", "The Croc"],
  ["octopus", "Eight Arms"],
  ["rabbit", "The Rabbit"],
  ["wolf", "The Wolf"],
  ["red-panda", "The Red Panda"],
  ["eagle", "The Eagle"],
  ["pig", "The Wildcard"],
  ["alien", "Out of This World"],
  ["shark", "The Shark"],
  ["tiger", "The Tiger"],
  ["bulldog", "The Bulldog"],
  ["penguin", "Ice Cold"],
  ["lion", "The Lion"],
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
