import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("@/lib/planning", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/planning")>()),
  loadPlanning: mocks.read,
  writePlanning: mocks.write,
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
import { PlanningPage } from "./PlanningPage";
import { pendingKey, type PlanningFeed } from "@/lib/planning";
function fixture(): PlanningFeed {
  return {
    organizer: false,
    server_now: "2026-09-27T12:00:00Z",
    poll_total: 1,
    night_total: 1,
    polls: [
      {
        id: "poll",
        title: "Choose a plan",
        scope: "both",
        status: "open",
        fixed_start: null,
        fixed_venue: null,
        closes_at: null,
        revision: 1,
        ballot_revision: 0,
        mine: [],
        suggestions_used: 0,
        voters: 0,
        options: [
          {
            id: "date",
            kind: "date",
            starts_at: "2090-10-09T23:00:00Z",
            venue: null,
            detail: "",
            suggested_by: null,
            withdrawn: false,
            votes: 0,
            author: null,
          },
          {
            id: "venue",
            kind: "venue",
            starts_at: null,
            venue: "Local hall",
            detail: "",
            suggested_by: null,
            withdrawn: false,
            votes: 0,
            author: null,
          },
        ],
        pairs: [],
        night_id: null,
      },
    ],
    nights: [
      {
        night_id: "night",
        title: "Friday darts",
        venue: "Local hall",
        starts_at: "2090-10-02T23:00:00Z",
        rsvp_closes_at: "2090-10-02T23:00:00Z",
        notes: "",
        status: "scheduled",
        source_poll: null,
        override_reason: "",
        revision: 1,
        event_revision: 1,
        responses: [],
        mine: null,
      },
    ],
  };
}
describe("planning page", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.read.mockReset().mockResolvedValue(fixture());
    mocks.write.mockReset().mockResolvedValue({ replayed: false });
  });
  afterEach(cleanup);
  it.each(["poll", "night"] as const)(
    "blocks an editor whose %s leaves the refreshed page without discarding edits",
    async (kind) => {
      const data = fixture();
      data.organizer = true;
      data.poll_total = 21;
      data.night_total = 21;
      data.polls[0].status = "draft";
      mocks.read.mockResolvedValue(data);
      render(<PlanningPage userId="organizer" />);
      await screen.findByText("Friday darts");
      if (kind === "poll")
        fireEvent.click(screen.getByText("Organizer controls"));
      fireEvent.click(
        screen.getByRole("button", {
          name: kind === "poll" ? "Edit / publish draft" : "Edit night",
        }),
      );
      const label = kind === "poll" ? "Poll title" : "Night name";
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "Keep these local edits" },
      });
      const next = structuredClone(data);
      if (kind === "poll") next.polls = [];
      else next.nights = [];
      mocks.read.mockResolvedValue(next);
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByText(/This item is no longer on the loaded page/);
      expect(screen.getByLabelText(label)).toHaveValue(
        "Keep these local edits",
      );
      expect(
        screen.getByRole("button", {
          name: kind === "poll" ? "Save draft" : "Save night changes",
        }),
      ).toBeDisabled();
      expect(
        screen.getByRole("button", {
          name: kind === "poll" ? "Next polls" : "Next nights",
        }),
      ).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
      expect(
        screen.getByRole("button", {
          name: kind === "poll" ? "Next polls" : "Next nights",
        }),
      ).toBeEnabled();
    },
  );
  it.each(["poll", "night"] as const)(
    "offers explicit recovery for a stale %s editor",
    async (kind) => {
      const data = fixture();
      data.organizer = true;
      data.polls[0].status = "draft";
      mocks.read.mockResolvedValue(data);
      render(<PlanningPage userId="organizer" />);
      await screen.findByText("Friday darts");
      if (kind === "poll")
        fireEvent.click(screen.getByText("Organizer controls"));
      fireEvent.click(
        screen.getByRole("button", {
          name: kind === "poll" ? "Edit / publish draft" : "Edit night",
        }),
      );
      const label = kind === "poll" ? "Poll title" : "Night name";
      fireEvent.change(screen.getByLabelText(label), {
        target: { value: "Unsaved local title" },
      });
      const next = structuredClone(data);
      if (kind === "poll") {
        next.polls[0].revision = 2;
        next.polls[0].title = "Other organizer title";
      } else {
        next.nights[0].revision = 2;
        next.nights[0].title = "Other organizer title";
      }
      mocks.read.mockResolvedValue(next);
      fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
      await screen.findByText(/This item changed since you opened it/);
      expect(screen.getByLabelText(label)).toHaveValue("Unsaved local title");
      expect(
        screen.getByRole("button", {
          name: kind === "poll" ? "Save draft" : "Save night changes",
        }),
      ).toBeDisabled();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Load latest version (discard my edits)",
        }),
      );
      expect(screen.getByLabelText(label)).toHaveValue("Other organizer title");
      fireEvent.submit(screen.getByLabelText(label).closest("form")!);
      await waitFor(() =>
        expect(mocks.write).toHaveBeenCalledWith(
          expect.objectContaining({
            payload: expect.objectContaining({ revision: 2 }),
          }),
        ),
      );
    },
  );
  it("keeps an unrelated unsaved editor when replaying another tab's request", async () => {
    const data = fixture();
    data.organizer = true;
    mocks.read.mockResolvedValue(data);
    render(<PlanningPage userId="organizer" />);
    fireEvent.click(await screen.findByRole("button", { name: "Create poll" }));
    fireEvent.change(screen.getByLabelText("Poll title"), {
      target: { value: "Keep my unsaved work" },
    });
    const request = {
      id: "other-tab",
      actor: "organizer",
      action: "save_poll",
      payload: { poll_id: "unrelated" },
    };
    localStorage.setItem(pendingKey("organizer"), JSON.stringify(request));
    fireEvent(
      window,
      new StorageEvent("storage", { key: pendingKey("organizer") }),
    );
    fireEvent.click(
      await screen.findByRole("button", {
        name: "Check / retry saved request",
      }),
    );
    await waitFor(() =>
      expect(localStorage.getItem(pendingKey("organizer"))).toBeNull(),
    );
    expect(screen.getByLabelText("Poll title")).toHaveValue(
      "Keep my unsaved work",
    );
  });
  it("offers only binary RSVPs and keeps unanswered separate", async () => {
    render(<PlanningPage userId="member" />);
    await screen.findByText("Friday darts");
    expect(screen.queryByRole("button", { name: "Maybe" })).toBeNull();
    expect(screen.getByText("You haven’t responded.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Not going" }));
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "rsvp",
          actor: "member",
          payload: expect.objectContaining({
            going: false,
            revision: 0,
            event_revision: 1,
          }),
        }),
      ),
    );
    expect(screen.queryByRole("button", { name: "Create poll" })).toBeNull();
  });
  it("retains the exact request after an uncertain save and retries with the same ID", async () => {
    mocks.write.mockRejectedValueOnce(new Error("lost response"));
    render(<PlanningPage userId="member" />);
    await screen.findByText("Friday darts");
    fireEvent.click(screen.getByRole("button", { name: "Going" }));
    await screen.findByText(/Confirmation was interrupted/);
    const first = mocks.write.mock.calls[0][0];
    expect(JSON.parse(localStorage.getItem(pendingKey("member"))!)).toEqual(
      first,
    );
    expect(screen.getByRole("button", { name: "Not going" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Check / retry saved request" }),
    );
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(2));
    expect(mocks.write.mock.calls[1][0]).toEqual(first);
    await waitFor(() =>
      expect(localStorage.getItem(pendingKey("member"))).toBeNull(),
    );
  });
  it("does not erase a newer cross-tab request when an earlier response completes", async () => {
    let finish!: (value: unknown) => void;
    mocks.write.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(<PlanningPage userId="member" />);
    await screen.findByText("Friday darts");
    fireEvent.click(screen.getByRole("button", { name: "Going" }));
    await waitFor(() => expect(mocks.write).toHaveBeenCalledTimes(1));
    const newer = {
      id: "newer",
      actor: "member",
      action: "vote",
      payload: { options: [] },
    };
    localStorage.setItem(pendingKey("member"), JSON.stringify(newer));
    await act(async () => finish({ replayed: false }));
    expect(JSON.parse(localStorage.getItem(pendingKey("member"))!)).toEqual(
      newer,
    );
  });
  it("preserves dirty ballot choices during refresh and exposes a stale-ballot conflict", async () => {
    render(<PlanningPage userId="member" />);
    await screen.findByText("Choose a plan");
    fireEvent.click(screen.getByRole("checkbox", { name: /Local hall/ }));
    const next = fixture();
    next.polls[0].mine = ["date"];
    next.polls[0].ballot_revision = 1;
    mocks.read.mockResolvedValue(next);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await screen.findByText(/Your ballot changed on another device/);
    expect(screen.getByRole("checkbox", { name: /Local hall/ })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Save my votes" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Load my saved ballot" }),
    );
    expect(
      screen.getByRole("checkbox", { name: /Local hall/ }),
    ).not.toBeChecked();
  });
  it("marks prior-revision RSVPs for reconfirmation and shows no Maybe state", async () => {
    const data = fixture();
    data.nights[0].event_revision = 2;
    data.nights[0].mine = { going: true, event_revision: 1, revision: 1 };
    mocks.read.mockResolvedValue(data);
    render(<PlanningPage userId="member" />);
    await screen.findByText("The date or venue changed. Please respond again.");
    const card = screen
      .getByRole("heading", { name: "Friday darts" })
      .closest("article")!;
    expect(within(card).getByRole("button", { name: "Going" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(card).getByText(/0 going · 0 not going/)).toBeInTheDocument();
  });
});
