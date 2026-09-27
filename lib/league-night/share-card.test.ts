import { expect, it, vi } from "vitest";
import { drawShareCard } from "./share-card";
import type { NightAward } from "./recap";

it("draws a legible card from approved summary fields only, including unbroken names", () => {
  const calls: { text: string; x: number; y: number }[] = [];
  const ctx = {
    font: "",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    textBaseline: "",
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    roundRect: vi.fn(),
    fill: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 22 }),
    fillText: (text: string, x: number, y: number) =>
      calls.push({ text, x, y }),
  };
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
  } as unknown as HTMLCanvasElement;
  const award: NightAward = {
    id: "best:a",
    kind: "best",
    title: "Personal Best",
    playerId: "a",
    playerName: "A".repeat(120),
    reason:
      "A wonderful recorded personal best with enough words to wrap cleanly onto another line",
    scope: "501 · Soft Tip",
    rule: "PRIVATE rule is not exported",
    matchIds: [1],
  };
  expect(
    drawShareCard(canvas, "Saturday, September 26, 2026", 3, 2, [award]),
  ).toBe(true);
  expect(canvas.width).toBe(1200);
  expect(canvas.height).toBeGreaterThan(680);
  expect(
    calls.some((c) => c.text.includes("Personal Best".toUpperCase())),
  ).toBe(true);
  expect(calls.every((c) => c.x >= 0 && c.y < canvas.height)).toBe(true);
  expect(calls.map((c) => c.text).join(" ")).not.toContain("PRIVATE");
  expect(drawShareCard(canvas, "Saturday", 0, 0, [])).toBe(true);
  expect(calls.some((c) => c.text === "Good darts. Better company.")).toBe(
    true,
  );
  expect(
    drawShareCard(
      { getContext: () => null } as unknown as HTMLCanvasElement,
      "Saturday",
      0,
      0,
      [],
    ),
  ).toBe(false);
});
