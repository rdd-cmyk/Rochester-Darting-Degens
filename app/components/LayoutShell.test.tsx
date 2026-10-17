import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import LayoutShell from "./LayoutShell";
vi.mock("./Navbar", () => ({
  default: ({
    seasonLabel,
    seasonalEnabled,
    onToggleSeasonal,
  }: {
    seasonLabel: string;
    seasonalEnabled: boolean;
    onToggleSeasonal: () => void;
  }) => (
    <button onClick={onToggleSeasonal}>
      {seasonLabel}: {seasonalEnabled ? "On" : "Off"}
    </button>
  ),
}));
vi.mock("./SeasonalOverlay", () => ({
  default: () => <span>Seasonal overlay</span>,
}));
it("hydrates a saved Off preference without a mismatch or overwriting it, then persists toggles", async () => {
  localStorage.setItem("seasonal-overlay-enabled", "false");
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const container = document.createElement("div");
  document.body.appendChild(container);
  const content = (
    <LayoutShell>
      <p>Solo page</p>
    </LayoutShell>
  );
  container.innerHTML = renderToString(content);
  expect(container.textContent).toContain("Seasonal: On");
  let root: ReturnType<typeof hydrateRoot>;
  const recoverable = vi.fn();
  await act(async () => {
    root = hydrateRoot(container, content, { onRecoverableError: recoverable });
  });
  expect(
    within(container).getByRole("button", { name: "Fall: Off" }),
  ).toBeInTheDocument();
  expect(localStorage.getItem("seasonal-overlay-enabled")).toBe("false");
  fireEvent.click(
    within(container).getByRole("button", { name: "Fall: Off" }),
  );
  expect(localStorage.getItem("seasonal-overlay-enabled")).toBe("true");
  expect(
    within(container).getByRole("button", { name: "Fall: On" }),
  ).toBeInTheDocument();
  expect(errors).not.toHaveBeenCalled();
  expect(recoverable).not.toHaveBeenCalled();
  await act(async () => root!.unmount());
  container.remove();
  errors.mockRestore();
  localStorage.removeItem("seasonal-overlay-enabled");
});
it("updates in memory when storage is readable but writes fail", () => {
  localStorage.setItem("seasonal-overlay-enabled", "false");
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage full", "QuotaExceededError");
  });
  const view = render(<LayoutShell><p>Solo page</p></LayoutShell>);
  fireEvent.click(screen.getByRole("button", { name: "Fall: Off" }));
  expect(screen.getByRole("button", { name: "Fall: On" })).toBeInTheDocument();
  expect(localStorage.getItem("seasonal-overlay-enabled")).toBe("false");
  fireEvent.click(screen.getByRole("button", { name: "Fall: On" }));
  expect(screen.getByRole("button", { name: "Fall: Off" })).toBeInTheDocument();
  write.mockRestore();
  fireEvent.click(screen.getByRole("button", { name: "Fall: Off" }));
  expect(localStorage.getItem("seasonal-overlay-enabled")).toBe("true");
  view.unmount();
  localStorage.removeItem("seasonal-overlay-enabled");
});
const route = vi.hoisted(() => ({ query: 'qaTheme=light' }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(route.query),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  vi.unstubAllEnvs();
  delete document.documentElement.dataset.qaTheme;
});

it('clears the local light override when client navigation drops its query parameter', () => {
  vi.stubEnv('NEXT_PUBLIC_RDD_VISUAL_FIXTURE', '1');
  route.query = 'qaTheme=light';
  const { rerender, unmount } = render(<LayoutShell><p>Preview</p></LayoutShell>);
  expect(document.documentElement.dataset.qaTheme).toBe('light');

  route.query = 'page=2';
  rerender(<LayoutShell><p>Next page</p></LayoutShell>);
  expect(document.documentElement.dataset.qaTheme).toBeUndefined();

  route.query = 'qaTheme=light&page=2';
  rerender(<LayoutShell><p>Light page</p></LayoutShell>);
  expect(document.documentElement.dataset.qaTheme).toBe('light');
  unmount();
  expect(document.documentElement.dataset.qaTheme).toBeUndefined();
});

it('preserves the legacy summer opt-out while saving future choices under the seasonal key', () => {
  localStorage.setItem('summer-overlay-enabled', 'false');
  const view = render(<LayoutShell><p>Preview</p></LayoutShell>);
  expect(screen.queryByText('Seasonal overlay')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Fall: Off' }));
  expect(localStorage.getItem('seasonal-overlay-enabled')).toBe('true');
  expect(screen.getByText('Seasonal overlay')).toBeInTheDocument();
  view.unmount();
});

it('changes season across Eastern midnight without a reload and keeps the saved opt-out', () => {
  vi.setSystemTime(new Date('2026-09-22T03:59:30Z'));
  localStorage.setItem('seasonal-overlay-enabled', 'false');
  const view = render(<LayoutShell><p>Preview</p></LayoutShell>);
  expect(screen.getByRole('button', { name: 'Summer: Off' })).toBeInTheDocument();
  act(() => vi.advanceTimersByTime(30_000));
  expect(screen.getByRole('button', { name: 'Fall: Off' })).toBeInTheDocument();
  expect(screen.queryByText('Seasonal overlay')).not.toBeInTheDocument();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('refreshes after a suspended tab resumes and syncs preference changes from another tab', () => {
  const view = render(<LayoutShell><p>Preview</p></LayoutShell>);
  vi.setSystemTime(new Date('2026-12-21T05:00:00Z'));
  fireEvent(document, new Event('visibilitychange'));
  expect(screen.getByRole('button', { name: 'Winter: On' })).toBeInTheDocument();
  localStorage.setItem('seasonal-overlay-enabled', 'false');
  fireEvent(window, new StorageEvent('storage'));
  expect(screen.getByRole('button', { name: 'Winter: Off' })).toBeInTheDocument();
  view.unmount();
});
