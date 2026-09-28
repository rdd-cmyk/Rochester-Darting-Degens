import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, within } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import LayoutShell from "./LayoutShell";
vi.mock("./Navbar", () => ({
  default: ({
    summerEnabled,
    onToggleSummer,
  }: {
    summerEnabled: boolean;
    onToggleSummer: () => void;
  }) => (
    <button onClick={onToggleSummer}>
      Summer: {summerEnabled ? "On" : "Off"}
    </button>
  ),
}));
vi.mock("./SummerOverlay", () => ({
  default: () => <span>Seasonal overlay</span>,
}));
it("hydrates a saved Off preference without a mismatch or overwriting it, then persists toggles", async () => {
  localStorage.setItem("summer-overlay-enabled", "false");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.appendChild(container);
  const content = (
    <LayoutShell>
      <p>Solo page</p>
    </LayoutShell>
  );
  container.innerHTML = renderToString(content);
  expect(container.textContent).toContain("Summer: On");
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, content);
  });
  expect(
    within(container).getByRole("button", { name: "Summer: Off" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem("summer-overlay-enabled")).toBe("false");
  fireEvent.click(
    within(container).getByRole("button", { name: "Summer: Off" }),
  );
  expect(localStorage.getItem("summer-overlay-enabled")).toBe("true");
  expect(
    within(container).getByRole("button", { name: "Summer: On" }),
  ).toBeInTheDocument();
  expect(errors).not.toHaveBeenCalled();
  await act(async () => root!.unmount());
  container.remove();
  errors.mockRestore();
  localStorage.removeItem("summer-overlay-enabled");
});
