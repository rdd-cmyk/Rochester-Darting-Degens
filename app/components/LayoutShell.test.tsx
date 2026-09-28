import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
  const recoverable = vi.fn();
  await act(async () => {
    root = hydrateRoot(container, content, { onRecoverableError: recoverable });
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
  expect(recoverable).not.toHaveBeenCalled();
  await act(async () => root!.unmount());
  container.remove();
  errors.mockRestore();
  localStorage.removeItem("summer-overlay-enabled");
});
it("updates in memory when storage is readable but writes fail", () => {
  localStorage.setItem("summer-overlay-enabled", "false");
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage full", "QuotaExceededError");
  });
  const view = render(<LayoutShell><p>Solo page</p></LayoutShell>);
  fireEvent.click(screen.getByRole("button", { name: "Summer: Off" }));
  expect(screen.getByRole("button", { name: "Summer: On" })).toBeInTheDocument();
  expect(localStorage.getItem("summer-overlay-enabled")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Summer: On" }));
  expect(screen.getByRole("button", { name: "Summer: Off" })).toBeInTheDocument();
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Summer: Off" }));
  expect(localStorage.getItem("summer-overlay-enabled")).toBe("true");
  view.unmount();
  localStorage.removeItem("summer-overlay-enabled");
});
