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
for (const sheet of sheets) {
  const source = path.join(sources, `${sheet.id}.png`);
  const meta = await sharp(source).metadata();
  if (meta.width !== 1536 || meta.height !== 1024)
    throw Error(`Unexpected sheet dimensions: ${sheet.id}`);
  for (let i = 0; i < 6; i++) {
    const name = sheet.names[i];
    const top = i < 3 ? 0 : 512;
    const cell = sharp(source).extract({
      left: (i % 3) * 512,
      top,
      width: 512,
      height: 500,
    });
    await cell
      .clone()
      .resize(512, 512, { fit: "contain", background: "#00000000" })
      .webp({ quality: 85 })
      .toFile(`${output}/${name}.webp`);
    await cell
      .clone()
      .resize(256, 256, { fit: "contain", background: "#00000000" })
      .webp({ quality: 82 })
      .toFile(`${output}/${name}-256.webp`);
    await cell
      .clone()
      .resize(96, 96, { fit: "contain", background: "#00000000" })
      .webp({ quality: 80 })
      .toFile(`${output}/${name}-96.webp`);
    manifest.push({
      id: name,
      label: labels.get(name),
      version: 1,
      review_status: "locally inspected; owner final acceptance pending",
      tool: "Built-in image_gen",
      generation_date: "2026-09-28",
      dimensions: { hero: [512, 512], medium: [256, 256], thumbnail: [96, 96] },
      source: `${sheet.id}.png`,
      cell: i,
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
writeFileSync(
  `${sources}/catalog.json`,
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log("Exported 24 individual portraits with 256px and 96px variants.");
