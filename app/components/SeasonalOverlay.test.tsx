import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import SeasonalOverlay from "./SeasonalOverlay";
import type { Season } from "@/lib/season";

it.each<[Season, string]>([
  ["fall", "🍁"], ["winter", "❄️"], ["spring", "🌸"], ["summer", "☀️"],
])("mixes actual darts with %s decorations in a hidden, bounded layer", (season, icon) => {
  const { container, unmount } = render(<SeasonalOverlay season={season} />);
  const layer = container.firstElementChild!;
  expect(layer).toHaveAttribute("aria-hidden", "true");
  expect(layer).toHaveAttribute("data-season", season);
  expect(layer.querySelectorAll(".seasonal-particle")).toHaveLength(18);
  expect(layer.querySelectorAll("svg")).toHaveLength(5);
  expect(layer.textContent).toContain(icon);
  if (season === "fall") expect(layer.textContent).not.toContain("🌴");
  unmount();
});
