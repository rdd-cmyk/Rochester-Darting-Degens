// Routine production exports from approved generated master sheets; no repainting.
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
const output = "public/avatars",
  sources = "docs/art/rivalry-avatars";
mkdirSync(output, { recursive: true });
mkdirSync(sources, { recursive: true });
const sheets = [
  {
    id: "pilot",
    names: ["raccoon", "fox", "bull", "owl", "robot", "skeleton"],
  },
  {
    id: "pack-b",
    names: ["badger", "panther", "bear", "crocodile", "octopus", "rabbit"],
  },
  {
    id: "pack-c",
    names: ["wolf", "red-panda", "eagle", "pig", "alien", "shark"],
  },
  {
    id: "pack-d",
    names: ["tiger", "bulldog", "penguin", "lion", "tortoise", "cat"],
  },
];
const manifest = [];
const labels = new Map(
  [
    ...readFileSync("lib/rivalries/catalog.ts", "utf8").matchAll(
      /\["([a-z-]+)", "([^"]+)"\]/g,
    ),
  ].map((m) => [m[1], m[2]]),
);
async function exportPortrait(cell, name) {
  for (const [size, suffix, quality] of [
    [512, "", 85],
    [256, "-256", 82],
    [96, "-96", 80],
  ]) {
    await cell.clone()
      .resize(size, size, { fit: "contain", background: "#00000000" })
      .webp({ quality })
      .toFile(`${output}/${name}${suffix}.webp`);
  }
}
for (const sheet of sheets) {
  const source = path.join(sources, `${sheet.id}.png`);
  const meta = await sharp(source).metadata();
  if (meta.width !== 1536 || meta.height !== 1024)
    throw Error(`Unexpected sheet dimensions: ${sheet.id}`);
  for (let i = 0; i < 6; i++) {
    const name = sheet.names[i];
    const top = i < 3 ? 0 : 512;
    // Individual replacements take precedence over the original sheet cell.
    const replacement = ({
      wolf: "wolf-v2.png",
      robot: "robot-v2.png",
      alien: "alien-v2.png",
      "red-panda": "red-panda-v2.png",
    })[name] ?? null;
    const cell = replacement ? sharp(path.join(sources, replacement)) : sharp(source).extract({
      left: (i % 3) * 512,
      top,
      width: 512,
      height: 500,
    });
    await exportPortrait(cell, name);
    manifest.push({
      id: name,
      label: labels.get(name),
      version: replacement ? 2 : 1,
      review_status: "locally inspected; owner final acceptance pending",
      tool: "Built-in image_gen",
      generation_date: replacement ? (name === "wolf" ? "2026-09-30" : "2026-10-01") : "2026-09-28",
      dimensions: { hero: [512, 512], medium: [256, 256], thumbnail: [96, 96] },
      source: replacement ?? `${sheet.id}.png`,
      cell: replacement ? null : i,
      image: `/avatars/${name}.webp`,
      thumbnail: `/avatars/${name}-96.webp`,
      medium: `/avatars/${name}-256.webp`,
      selectable: true,
    });
  }
  const stats = await sharp(source).stats();
  console.log(
    `${sheet.id}: ${meta.width}x${meta.height}, alpha minimum ${stats.channels[3]?.min ?? "none"}`,
  );
}
// New standalone portraits do not need a six-character source sheet.
for (const name of ["cactus", "gorilla", "dragon"]) {
  const source = ({
    cactus: "cactus-alt-focused.png",
    gorilla: "gorilla.png",
    dragon: "dragon-alt-fierce-near-smoke.png",
  })[name];
  await exportPortrait(sharp(path.join(sources, source)), name);
  manifest.push({
    id: name,
    label: labels.get(name),
    version: name === "gorilla" ? 1 : 2,
    review_status: "owner artwork and name accepted 2026-10-05; publication pending",
    tool: "Built-in image_gen",
    generation_date: "2026-10-05",
    dimensions: { hero: [512, 512], medium: [256, 256], thumbnail: [96, 96] },
    source,
    cell: null,
    image: `/avatars/${name}.webp`,
    thumbnail: `/avatars/${name}-96.webp`,
    medium: `/avatars/${name}-256.webp`,
    selectable: true,
  });
}
writeFileSync(
  `${sources}/catalog.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`Exported ${manifest.length} individual portraits with 256px and 96px variants.`);
