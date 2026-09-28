import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanningFeed, ScheduledNight } from "@/lib/planning";

const mocks = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/lib/planning", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/planning")>()),
  loadPlanning: mocks.read,
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
import { NextPlannedNight } from "./NextPlannedNight";

const browserStart = Date.parse("2026-09-27T12:00:00Z");
const serverStart = browserStart + 60 * 60 * 1000;
function night(id: string, startsIn: number): ScheduledNight {
  return {
    night_id: id,
    title: id,
    venue: "QA local hall",
    starts_at: new Date(serverStart + startsIn).toISOString(),
    rsvp_closes_at: new Date(serverStart + startsIn).toISOString(),
    status: "scheduled",
    notes: "",
    source_poll: null,
    override_reason: "",
    revision: 1,
    event_revision: 1,
    responses: [],
    mine: null,
  };
}
function feed(): PlanningFeed {
  return {
    organizer: false,
    server_now: new Date(serverStart + Date.now() - browserStart).toISOString(),
    polls: [],
    nights: [night("First night", 1000), night("Following night", 10000)],
    poll_total: 0,
    night_total: 2,
  };
}

describe("next planned night", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(browserStart);
    mocks.read.mockReset().mockImplementation(async () => feed());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("advances at the server-adjusted start time without a focus event", async () => {
    await act(async () => {
      render(<NextPlannedNight />);
    });
    expect(screen.getByText(/First night/)).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByText(/First night/)).not.toBeInTheDocument();
    expect(screen.getByText(/Following night/)).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });
    expect(screen.queryByText(/Following night/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Plan the next night" }),
    ).toBeInTheDocument();
  });

  it("stops displaying a started night even when the boundary refresh fails", async () => {
    await act(async () => {
      render(<NextPlannedNight />);
    });
    mocks.read.mockRejectedValue(new Error("Local connection interrupted"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByText(/First night/)).not.toBeInTheDocument();
    expect(screen.getByText(/Following night/)).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });

  it("cleans up automatic and focus refreshes when the card unmounts", async () => {
    const view = render(<NextPlannedNight />);
    await act(async () => {});
    view.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    fireEvent.focus(window);
    expect(mocks.read).toHaveBeenCalledTimes(1);
  });

  it("keeps the newest calendar when refresh responses arrive out of order", async () => {
    await act(async () => {
      render(<NextPlannedNight />);
    });
    let resolveOlder!: (data: PlanningFeed) => void;
    mocks.read.mockImplementationOnce(
      () =>
        new Promise<PlanningFeed>((resolve) => {
          resolveOlder = resolve;
        }),
    );
    fireEvent.focus(window);
    const newest = feed();
    newest.nights[0].status = "cancelled";
    mocks.read.mockResolvedValueOnce(newest);
    await act(async () => {
      fireEvent.focus(window);
    });
    expect(screen.getByText(/Following night/)).toBeInTheDocument();
    await act(async () => {
      resolveOlder(feed());
    });
    expect(screen.queryByText(/First night/)).not.toBeInTheDocument();
    expect(screen.getByText(/Following night/)).toBeInTheDocument();
  });
});
