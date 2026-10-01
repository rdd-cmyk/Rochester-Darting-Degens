"use client";
import { ActionButton } from "@/components/ui/ActionButton";

import { useState } from "react";
import {
  optionLabel,
  rochesterInput,
  type PlanningAction,
  type Poll,
  type Scope,
  type ScheduledNight,
} from "@/lib/planning";
export type ChangePlanning = (
  action: PlanningAction,
  payload: Record<string, unknown>,
) => Promise<boolean>;
type Seed = {
  kind: "date" | "venue";
  starts_local: string;
  venue: string;
  detail: string;
};
export function PollForm({
  poll,
  blocked = false,
  duplicate = false,
  onClose,
  change,
}: {
  poll?: Poll;
  blocked?: boolean;
  duplicate?: boolean;
  onClose: () => void;
  change: ChangePlanning;
}) {
  const [id] = useState(() =>
    duplicate || !poll ? crypto.randomUUID() : poll.id,
  );
  const [title, setTitle] = useState(poll?.title ?? "Next league night");
  const [scope, setScope] = useState<Scope>(poll?.scope ?? "both");
  const [autoClose, setAutoClose] = useState(Boolean(poll?.closes_at) || !poll);
  const [deadline, setDeadline] = useState(
    duplicate ? "" : rochesterInput(poll?.closes_at ?? null),
  );
  const [fixedDate, setFixedDate] = useState(
    rochesterInput(poll?.fixed_start ?? null),
  );
  const [fixedVenue, setFixedVenue] = useState(poll?.fixed_venue ?? "");
  const [options, setOptions] = useState<Seed[]>(
    () =>
      poll?.options
        .filter((o) => !o.withdrawn)
        .map((o) => ({
          kind: o.kind,
          starts_local: rochesterInput(o.starts_at),
          venue: o.venue ?? "",
          detail: o.detail,
        })) ?? [
        { kind: "date", starts_local: "", venue: "", detail: "" },
        { kind: "venue", starts_local: "", venue: "", detail: "" },
      ],
  );
  function update(index: number, patch: Partial<Seed>) {
    setOptions((values) =>
      values.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    );
  }
  return (
    <section className="rdd-content-panel plan-stack" aria-label="Poll editor">
      <div className="plan-head">
        <h2>
          {duplicate
            ? "Copy into a new poll"
            : poll
              ? "Edit draft"
              : "Create a planning poll"}
        </h2>
        <ActionButton onClick={onClose}>Cancel</ActionButton>
      </div>
      <form
        className="plan-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (blocked) return;
          const publish =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
            "publish";
          if (
            await change("save_poll", {
              poll_id: id,
              revision: duplicate ? 0 : (poll?.revision ?? 0),
              title,
              scope,
              closes_local: autoClose ? deadline : null,
              fixed_start_local: scope === "venue" ? fixedDate : null,
              fixed_venue: scope === "date" ? fixedVenue : null,
              options: options.filter(
                (o) =>
                  (scope === "both" || scope === o.kind) &&
                  (o.starts_local || o.venue.trim()),
              ),
              publish,
            })
          )
            onClose();
        }}
      >
        <label>
          Poll title
          <input
            maxLength={100}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Vote on
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            <option value="both">Date & time and venue</option>
            <option value="date">Date & time only</option>
            <option value="venue">Venue only</option>
          </select>
        </label>
        {scope === "date" && (
          <label>
            Fixed venue (optional)
            <input
              maxLength={49}
              value={fixedVenue}
              onChange={(e) => setFixedVenue(e.target.value)}
            />
          </label>
        )}
        {scope === "venue" && (
          <label>
            Fixed date & time (optional, Rochester time)
            <input
              type="datetime-local"
              value={fixedDate}
              onChange={(e) => setFixedDate(e.target.value)}
            />
          </label>
        )}
        <label className="night-check">
          <input
            type="checkbox"
            checked={autoClose}
            onChange={(e) => setAutoClose(e.target.checked)}
          />
          Close automatically at a set time
        </label>
        {autoClose ? (
          <label>
            Voting closes (Rochester time)
            <input
              type="datetime-local"
              required
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </label>
        ) : (
          <p className="plan-muted">
            Manual close only. An organizer will close voting.
          </p>
        )}
        <p className="plan-muted">
          Once published, the question and deadline are fixed. You can close
          early. Each person can add two suggestions after publication.
        </p>
        {(["date", "venue"] as const)
          .filter((kind) => scope === "both" || scope === kind)
          .map((kind) => (
            <fieldset className="plan-stack" key={kind}>
              <legend>
                {kind === "date"
                  ? "Initial date & time options"
                  : "Initial venue options"}
              </legend>
              {options.map((option, index) =>
                option.kind !== kind ? null : (
                  <div className="plan-seed" key={index}>
                    <label>
                      {kind === "date"
                        ? `Date option ${index + 1} (Rochester time)`
                        : `Venue option ${index + 1}`}
                      <input
                        type={kind === "date" ? "datetime-local" : "text"}
                        maxLength={kind === "venue" ? 49 : undefined}
                        value={
                          kind === "date" ? option.starts_local : option.venue
                        }
                        onChange={(e) =>
                          update(
                            index,
                            kind === "date"
                              ? { starts_local: e.target.value }
                              : { venue: e.target.value },
                          )
                        }
                      />
                    </label>
                    <ActionButton
                      type="button"
                      onClick={() =>
                        setOptions((values) =>
                          values.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove option {index + 1}
                    </ActionButton>
                  </div>
                ),
              )}
              <ActionButton
                type="button"
                disabled={options.length >= 20}
                onClick={() =>
                  setOptions((values) => [
                    ...values,
                    { kind, starts_local: "", venue: "", detail: "" },
                  ])
                }
              >
                Add {kind === "date" ? "date" : "venue"} option
              </ActionButton>
            </fieldset>
          ))}
        <div className="plan-row">
          <ActionButton
            disabled={blocked}
            type="submit"
            value="publish"
            variant="primary"
          >
            Publish poll
          </ActionButton>
          <ActionButton disabled={blocked} type="submit" value="draft">
            Save draft
          </ActionButton>
        </div>
      </form>
    </section>
  );
}

export function ScheduleForm({
  poll,
  blocked = false,
  night,
  now,
  onClose,
  change,
}: {
  poll?: Poll;
  night?: ScheduledNight;
  now: number;
  blocked?: boolean;
  onClose: () => void;
  change: ChangePlanning;
}) {
  const dates =
    poll?.options
      .filter((o) => o.kind === "date" && !o.withdrawn)
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) ?? [];
  const venues =
    poll?.options
      .filter((o) => o.kind === "venue" && !o.withdrawn)
      .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)) ?? [];
  const [dateId, setDateId] = useState(dates[0]?.id ?? "");
  const [venueId, setVenueId] = useState(venues[0]?.id ?? "");
  const [title, setTitle] = useState(
    night?.title ?? poll?.title ?? "League night",
  );
  const [starts, setStarts] = useState(
    rochesterInput(night?.starts_at ?? poll?.fixed_start ?? null),
  );
  const [venue, setVenue] = useState(night?.venue ?? poll?.fixed_venue ?? "");
  const [cutoff, setCutoff] = useState(
    rochesterInput(night?.rsvp_closes_at ?? null),
  );
  const [notes, setNotes] = useState(night?.notes ?? "");
  const [reason, setReason] = useState("");
  const eventChanged = Boolean(
    night &&
      (starts !== rochesterInput(night.starts_at) ||
        venue.trim() !== night.venue),
  );
  const needsFutureCutoff = Boolean(
    eventChanged &&
      cutoff &&
      cutoff <= rochesterInput(new Date(now).toISOString()),
  );
  const lowerSupport = Boolean(
    (dates.length &&
      dates.find((o) => o.id === dateId)?.votes !== dates[0]?.votes) ||
      (venues.length &&
        venues.find((o) => o.id === venueId)?.votes !== venues[0]?.votes),
  );
  const overlap =
    poll?.pairs.find((p) => p.date_id === dateId && p.venue_id === venueId)
      ?.support ?? 0;
  return (
    <section className="rdd-content-panel plan-stack" aria-label="Night editor">
      <div className="plan-head">
        <h2>{night ? "Edit scheduled night" : "Put it on the calendar"}</h2>
        <ActionButton onClick={onClose}>Cancel</ActionButton>
      </div>
      <form
        className="plan-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (blocked || needsFutureCutoff) return;
          if (
            await change(night ? "edit_night" : "schedule", {
              night_id: night?.night_id ?? null,
              revision: night?.revision ?? 0,
              poll_id: poll?.id ?? null,
              title,
              starts_local: starts,
              venue,
              date_option: dateId || null,
              venue_option: venueId || null,
              rsvp_closes_local: cutoff || null,
              notes,
              override_reason: reason,
            })
          )
            onClose();
        }}
      >
        <label>
          Night name
          <input
            maxLength={60}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="plan-grid">
          {poll && poll.scope !== "venue" ? (
            <label>
              Confirmed date & time
              <select
                required
                value={dateId}
                onChange={(e) => setDateId(e.target.value)}
              >
                <option value="">Choose a date</option>
                {dates.map((o) => (
                  <option key={o.id} value={o.id}>
                    {optionLabel(o)} · {o.votes} {o.votes === 1 ? "vote" : "votes"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Date & time (Rochester time)
              <input
                type="datetime-local"
                required
                readOnly={Boolean(poll?.fixed_start)}
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
              />
            </label>
          )}
          {poll && poll.scope !== "date" ? (
            <label>
              Confirmed venue
              <select
                required
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
              >
                <option value="">Choose a venue</option>
                {venues.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.venue} · {o.votes} {o.votes === 1 ? "vote" : "votes"}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Venue
              <input
                required
                maxLength={49}
                readOnly={Boolean(poll?.fixed_venue)}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </label>
          )}
        </div>
        {poll?.scope === "both" && (
          <p className="plan-notice">
            {overlap} people voted for both of these options. Everyone will
            RSVP separately.
          </p>
        )}
        {lowerSupport && (
          <label>
            Why choose an option with fewer votes?
            <input
              required
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        )}
        <label>
          RSVP cutoff (optional, Rochester time)
          <input
            type="datetime-local"
            value={cutoff}
            onChange={(e) => setCutoff(e.target.value)}
          />
          <span className="plan-muted">
            Leave blank to close RSVPs at the start. A cutoff cannot be later
            than the start.
          </span>
        </label>
        <label>
          Notes (optional)
          <textarea
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        {night && (
          <p className="plan-notice">
            Changing the date, time or venue will ask everyone to respond again.
            Previous responses will leave the current totals.
          </p>
        )}
        {needsFutureCutoff && (
          <p className="plan-notice" role="alert">
            Choose a future RSVP cutoff or leave it blank so everyone can
            respond again.
          </p>
        )}
        <ActionButton
          disabled={blocked || needsFutureCutoff}
          type="submit"
          variant="primary"
        >
          {night ? "Save night changes" : "Confirm & schedule"}
        </ActionButton>
      </form>
    </section>
  );
}
