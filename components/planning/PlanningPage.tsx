"use client";
import { ActionButton } from "@/components/ui/ActionButton";
import { ActionLink } from "@/components/ui/ActionLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPlayerName } from "@/lib/playerName";
import {
  isPlanningRejection,
  loadPlanning,
  optionLabel,
  pendingKey,
  planningMessage,
  pollClosed,
  readPending,
  rochesterTime,
  rsvpClosed,
  writePlanning,
  type PendingPlanning,
  type PlanningFeed,
  type Poll,
  type ScheduledNight,
} from "@/lib/planning";
import { PollForm, ScheduleForm, type ChangePlanning } from "./PlanningForms";
import { CalendarDownload } from "./CalendarDownload";

export function PlanningPage({ userId }: { userId: string }) {
  const [feed, setFeed] = useState<PlanningFeed | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<PendingPlanning | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [pollOffset, setPollOffset] = useState(0);
  const [eventOffset, setEventOffset] = useState(0);
  const [now, setNow] = useState(Date.now);
  const [editor, setEditor] = useState<{
    kind: "poll" | "night";
    poll?: Poll;
    night?: ScheduledNight;
    duplicate?: boolean;
  } | null>(null);
  // Only this tab's submitting editor may be closed by request recovery.
  const submittedEditor = useRef<{ id: string; editor: typeof editor } | null>(
    null,
  );
  const latestPoll =
    editor?.poll && feed?.polls.find((p) => p.id === editor.poll?.id);
  const latestNight =
    editor?.night &&
    feed?.nights.find((n) => n.night_id === editor.night?.night_id);
  const missingEditor = Boolean(
    feed &&
      !editor?.duplicate &&
      ((editor?.poll && !latestPoll) || (editor?.night && !latestNight)),
  );
  const staleEditor = Boolean(
    missingEditor ||
      (!editor?.duplicate &&
        latestPoll &&
        latestPoll.revision !== editor?.poll?.revision) ||
      (latestNight && latestNight.revision !== editor?.night?.revision),
  );
  const canReloadEditor =
    editor?.kind === "poll"
      ? latestPoll?.status === "draft"
      : editor?.night
        ? latestNight?.status === "scheduled"
        : latestPoll?.status === "closed";
  const active = useRef(false);
  const inFlight = useRef(false);
  const readSequence = useRef(0);
  const serverOffset = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++readSequence.current;
    try {
      const data = await loadPlanning(pollOffset, eventOffset);
      if (active.current && sequence === readSequence.current) {
        serverOffset.current = Date.parse(data.server_now) - Date.now();
        setNow(Date.parse(data.server_now));
        setFeed(data);
        setError("");
      }
      return true;
    } catch (cause) {
      if (active.current && sequence === readSequence.current)
        setError(planningMessage(cause));
      return false;
    }
  }, [pollOffset, eventOffset]);
  useEffect(() => {
    active.current = true;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore a user-scoped request from external browser storage.
      setPending(readPending(userId));
      setReady(true);
    } catch (cause) {
      setStorageError(
        cause instanceof Error
          ? cause.message
          : "Browser storage is unavailable.",
      );
    }
    void refresh();
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(visible, 20000);
    const clock = setInterval(
      () => setNow(Date.now() + serverOffset.current),
      1000,
    );
    const sync = () => {
      try {
        setPending(readPending(userId));
      } catch {
        setStorageError(
          "Stored request cannot be read. Keep this browser data while it is checked.",
        );
      }
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("storage", sync);
    return () => {
      active.current = false;
      clearInterval(timer);
      clearInterval(clock);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("storage", sync);
    };
  }, [refresh, userId]);
  const release = async (request: PendingPlanning) => {
    const settle = () => {
      const stored = readPending(userId);
      if (stored?.id === request.id)
        localStorage.removeItem(pendingKey(userId));
      setPending(readPending(userId));
    };
    if (navigator.locks)
      await navigator.locks.request(pendingKey(userId), settle);
    else settle();
  };
  const perform = async (request: PendingPlanning): Promise<boolean> => {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setNotice("");
    try {
      await writePlanning(request);
      // A successful write is still confirmed if the subsequent feed refresh fails.
      if (active.current) {
        await release(request);
        setNotice("Saved.");
        const submitted = submittedEditor.current;
        if (submitted?.id === request.id) {
          setEditor((current) =>
            current === submitted.editor ? null : current,
          );
          submittedEditor.current = null;
        }
        await refresh();
      }
      return true;
    } catch (cause) {
      if (active.current) {
        if (isPlanningRejection(cause)) {
          await release(request);
          setNotice(planningMessage(cause));
          await refresh();
        } else setNotice(planningMessage(cause));
      }
      return false;
    } finally {
      inFlight.current = false;
      if (active.current) setBusy(false);
    }
  };
  const change: ChangePlanning = async (action, payload) => {
    if (pending || busy || !ready || storageError || inFlight.current)
      return false;
    try {
      // Web Locks serialize this browser's tabs while the durable request is
      // reserved; the database separately serializes all devices and retries.
      let request: PendingPlanning | null = null;
      const reserve = () => {
        const existing = readPending(userId);
        if (existing) {
          setPending(existing);
          return;
        }
        request = { id: crypto.randomUUID(), actor: userId, action, payload };
        localStorage.setItem(pendingKey(userId), JSON.stringify(request));
        if (["save_poll", "schedule", "edit_night"].includes(action))
          submittedEditor.current = { id: request.id, editor };
        setPending(request);
      };
      if (navigator.locks)
        await navigator.locks.request(pendingKey(userId), reserve);
      else reserve();
      return request ? await perform(request) : false;
    } catch {
      setStorageError(
        "Browser storage is unavailable. Enable storage before submitting changes so interrupted requests can be recovered.",
      );
      return false;
    }
  };
  return (
    <main className="rdd-page-shell planning-page rdd-form-controls">
        <PageHeader eyebrow="Plan & RSVP" title="Make the next night happen"
          description="Pick a night. Find a spot. Get the lineup ready."
          actions={<>
            <ActionLink className="plan-link" href="/league-night">← League Night</ActionLink>
            {feed?.organizer && <>
            <ActionButton disabled={Boolean(pending) || busy || !ready} onClick={() => setEditor({ kind: "poll" })}>Create poll</ActionButton>
            <ActionButton variant="primary" disabled={Boolean(pending) || busy || !ready} onClick={() => setEditor({ kind: "night" })}>Schedule a night</ActionButton>
            </>}
          </>} />
      <div className="plan-head plan-toolbar">
        <p className="plan-muted">
          Rochester time ·{" "}
          {feed
            ? `Updated ${rochesterTime(feed.server_now)}`
            : "Loading planning…"}
        </p>
        <ActionButton disabled={busy} onClick={() => void refresh()}>
          Refresh
        </ActionButton>
      </div>
      {error && (
        <p className="night-warning" role="alert">
          {feed ? `${error} Showing the last loaded information.` : "Couldn’t load planning. Refresh to try again."}
        </p>
      )}
      {storageError && (
        <p className="night-warning" role="alert">
          {storageError}
        </p>
      )}
      {pending && (
        <section
          className="night-warning"
          aria-label="Pending planning request"
        >
          <p>
            {busy
              ? "Saving…"
              : "A submitted request still needs confirmation. Check it before making another change."}
          </p>
          <ActionButton disabled={busy} onClick={() => void perform(pending)}>
            Check / retry saved request
          </ActionButton>
        </section>
      )}
      <p className="plan-status" role="status">
        {notice}
      </p>
      <fieldset
        disabled={busy || Boolean(pending) || !ready || Boolean(storageError)}
        className="plan-stack"
      >
        <legend className="sr-only">League planning</legend>
        {staleEditor && (
          <div className="night-warning" role="alert">
            <p>
              {missingEditor
                ? "This item is no longer on the loaded page. Keep any edits you need from the form below, then close the editor and locate the latest item in the list."
                : "This item changed since you opened it. Your edits are still shown below."}
            </p>
            {!missingEditor && canReloadEditor ? (
              <ActionButton
                onClick={() =>
                  setEditor(
                    (current) =>
                      current && {
                        ...current,
                        poll: latestPoll || current.poll,
                        night: latestNight || current.night,
                      },
                  )
                }
              >
                Load latest version (discard my edits)
              </ActionButton>
            ) : !missingEditor ? (
              <p>Its status no longer allows this edit.</p>
            ) : null}
            <ActionButton onClick={() => setEditor(null)}>Close editor</ActionButton>
          </div>
        )}
        <fieldset className="plan-stack">
          <legend className="sr-only">Planning editor</legend>
          {editor?.kind === "poll" && feed?.organizer && (
            <PollForm
              key={`${editor.poll?.id ?? "new"}:${editor.duplicate}:${editor.poll?.revision}`}
              poll={editor.poll}
              duplicate={editor.duplicate}
              blocked={staleEditor}
              change={change}
              onClose={() =>
                setEditor((current) => (current === editor ? null : current))
              }
            />
          )}
          {editor?.kind === "night" && feed?.organizer && (
            <ScheduleForm
              key={`${editor.night?.night_id ?? editor.poll?.id ?? "new-night"}:${editor.night?.revision ?? editor.poll?.revision}`}
              night={editor.night}
              now={now}
              blocked={staleEditor}
              poll={editor.poll}
              change={change}
              onClose={() =>
                setEditor((current) => (current === editor ? null : current))
              }
            />
          )}
        </fieldset>
        <section className="plan-stack" aria-label="Upcoming league nights">
          <h2 className="rdd-section-title">On the calendar</h2>
          {feed?.nights.map((n) => (
            <NightCard
              key={n.night_id}
              night={n}
              now={now}
              organizer={feed.organizer}
              change={change}
              edit={() => setEditor({ kind: "night", night: n })}
            />
          ))}
          {feed && !feed.nights.length && (
            <div className="rdd-content-panel">
              <h3>No upcoming nights yet.</h3>
              <p>
                Vote on a plan below, or check back for the next confirmed
                night.
              </p>
            </div>
          )}
          {feed && (
            <Pagination
              offset={eventOffset}
              total={feed.night_total}
              label="nights"
              disabled={Boolean(editor)}
              move={setEventOffset}
            />
          )}
        </section>
        <section className="plan-stack" aria-label="Planning polls">
          <h2 className="rdd-section-title">Choose the next one</h2>
          {feed?.polls.map((p) => (
            <PollCard
              key={p.id}
              poll={p}
              now={now}
              userId={userId}
              organizer={feed.organizer}
              change={change}
              edit={(duplicate) =>
                setEditor({ kind: "poll", poll: p, duplicate })
              }
              schedule={() => setEditor({ kind: "night", poll: p })}
            />
          ))}
          {feed && !feed.polls.length && (
            <div className="rdd-content-panel">
              <h3>No polls yet.</h3>
              <p>
                {feed.organizer
                  ? "Create a poll to find a date, a venue, or both."
                  : "Your organizers can open a poll for the next league night."}
              </p>
            </div>
          )}
          {feed && (
            <Pagination
              offset={pollOffset}
              total={feed.poll_total}
              label="polls"
              disabled={Boolean(editor)}
              move={setPollOffset}
            />
          )}
        </section>
      </fieldset>
    </main>
  );
}
function Pagination({
  offset,
  total,
  label,
  move,
  disabled = false,
}: {
  offset: number;
  total: number;
  label: string;
  move: (offset: number) => void;
  disabled?: boolean;
}) {
  if (total <= 20 && offset === 0) return null;
  return (
    <div className="plan-row">
      <ActionButton
        disabled={disabled || !offset}
        onClick={() => move(Math.max(0, offset - 20))}
      >
        Previous {label}
      </ActionButton>
      <span>
        {offset + 1}–{Math.min(offset + 20, total)} of {total}
      </span>
      <ActionButton
        disabled={disabled || offset + 20 >= total}
        onClick={() => move(offset + 20)}
      >
        Next {label}
      </ActionButton>
    </div>
  );
}
function NightCard({
  night,
  now,
  organizer,
  change,
  edit,
}: {
  night: ScheduledNight;
  now: number;
  organizer: boolean;
  change: ChangePlanning;
  edit: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const closed = rsvpClosed(night, now);
  const current = night.mine?.event_revision === night.event_revision;
  const yes = night.responses.filter((r) => r.going);
  const no = night.responses.filter((r) => !r.going);
  return (
    <article className="rdd-content-panel plan-card plan-stack plan-night-card">
      <div className="plan-head">
        <h3>{night.title}</h3>
        <span className="plan-badge">
          {night.status === "cancelled"
            ? "Cancelled"
            : Date.parse(night.starts_at) <= now
              ? "Started"
              : "Scheduled"}
        </span>
      </div>
      <div className="plan-night-context">
        <p>
          <strong>{rochesterTime(night.starts_at)}</strong>
          <br />
          {night.venue}
        </p>
        {night.notes && <p>{night.notes}</p>}
        {night.status !== "cancelled" && (
          <ActionLink
            className="plan-link"
            href={`/league-night?night=${night.night_id}`}
          >
            Open this league night →
          </ActionLink>
        )}
        {night.override_reason && (
          <p className="plan-muted">
            Organizer’s choice: {night.override_reason}
          </p>
        )}
      </div>
      <div className="plan-night-response">
        <div className="plan-row">
          <span>Will you be there?</span>
          <ActionButton
            className="plan-choice"
            disabled={closed}
            aria-pressed={current && night.mine?.going === true}
            onClick={() =>
              void change("rsvp", {
                night_id: night.night_id,
                event_revision: night.event_revision,
                revision: night.mine?.revision ?? 0,
                going: true,
              })
            }
          >
            Going
          </ActionButton>
          <ActionButton
            className="plan-choice"
            disabled={closed}
            aria-pressed={current && night.mine?.going === false}
            onClick={() =>
              void change("rsvp", {
                night_id: night.night_id,
                event_revision: night.event_revision,
                revision: night.mine?.revision ?? 0,
                going: false,
              })
            }
          >
            Not going
          </ActionButton>
        </div>
        <p className="plan-muted">
          {yes.length} going · {no.length} not going ·{" "}
          {closed
            ? "RSVPs closed"
            : `Respond by ${rochesterTime(night.rsvp_closes_at)}`}
        </p>
        <p>
          {night.mine && !current
            ? "The date or venue changed. Please respond again."
            : current
              ? `Your response: ${night.mine?.going ? "Going" : "Not going"}`
              : "You haven’t responded."}
        </p>
        {night.status === "scheduled" && Date.parse(night.starts_at) > now && (
          <CalendarDownload key={`${night.night_id}:${night.revision}`} night={night} />
        )}
        <details>
          <summary>See responses</summary>
          <h3>Going</h3>
          <ul className="plan-people">
            {yes.map((r) => (
              <li key={r.user_id}>
                {formatPlayerName(
                  r.profile.display_name,
                  r.profile.first_name,
                  r.profile.include_first_name_in_display,
                )}
              </li>
            ))}
          </ul>
          {!yes.length && <p>No responses yet.</p>}
          <h3>Not going</h3>
          <ul className="plan-people">
            {no.map((r) => (
              <li key={r.user_id}>
                {formatPlayerName(
                  r.profile.display_name,
                  r.profile.first_name,
                  r.profile.include_first_name_in_display,
                )}
              </li>
            ))}
          </ul>
          {!no.length && <p>No responses yet.</p>}
        </details>
      </div>
      {organizer &&
        night.status !== "cancelled" &&
        Date.parse(night.starts_at) > now && (
          <details>
            <summary>Manage night</summary>
            <div className="plan-row">
              <ActionButton onClick={edit}>Edit night</ActionButton>
              <ActionButton onClick={() => setConfirm(true)}>Cancel night</ActionButton>
            </div>
            {confirm && (
              <div className="plan-notice">
                <p>
                  Cancel this night and stop RSVPs? Its history will be kept.
                </p>
                <div className="plan-row">
                  <ActionButton
                    onClick={async () => {
                      if (
                        await change("cancel_night", {
                          night_id: night.night_id,
                          revision: night.revision,
                        })
                      )
                        setConfirm(false);
                    }}
                  >
                    Yes, cancel night
                  </ActionButton>
                  <ActionButton onClick={() => setConfirm(false)}>Keep night</ActionButton>
                </div>
              </div>
            )}
          </details>
        )}
    </article>
  );
}
function PollCard({
  poll,
  now,
  userId,
  organizer,
  change,
  edit,
  schedule,
}: {
  poll: Poll;
  now: number;
  userId: string;
  organizer: boolean;
  change: ChangePlanning;
  edit: (duplicate: boolean) => void;
  schedule: () => void;
}) {
  const [selected, setSelected] = useState(poll.mine);
  const [ballotRevision, setBallotRevision] = useState(poll.ballot_revision);
  const [dirty, setDirty] = useState(false);
  const [suggest, setSuggest] = useState(false);
  const [kind, setKind] = useState<"date" | "venue">(
    poll.scope === "venue" ? "venue" : "date",
  );
  const [starts, setStarts] = useState("");
  const [venue, setVenue] = useState("");
  const [detail, setDetail] = useState("");
  const [confirm, setConfirm] = useState<"close_poll" | "cancel_poll" | null>(
    null,
  );
  const closed = pollClosed(poll, now);
  const shown = closed ? poll.mine : dirty ? selected : poll.mine;
  const stale = dirty && ballotRevision !== poll.ballot_revision;
  function select(id: string, checked: boolean) {
    if (!dirty) {
      setBallotRevision(poll.ballot_revision);
      setSelected(
        checked ? [...poll.mine, id] : poll.mine.filter((v) => v !== id),
      );
    } else
      setSelected((values) =>
        checked ? [...values, id] : values.filter((v) => v !== id),
      );
    setDirty(true);
  }
  return (
    <article className="rdd-content-panel plan-stack">
      <div className="plan-head">
        <span className="plan-badge">
          {poll.status === "open" && closed
            ? "Closed"
            : poll.status[0].toUpperCase() + poll.status.slice(1)}
        </span>
        <span className="plan-muted">
          {poll.closes_at
            ? `${closed ? "Deadline" : "Closes"} ${rochesterTime(poll.closes_at)}`
            : "Manual close only"}{" "}
          · {poll.voters} {poll.voters === 1 ? "person" : "people"} voted
        </span>
      </div>
      <h3>{poll.title}</h3>
      {poll.fixed_start && <p>Fixed date: {rochesterTime(poll.fixed_start)}</p>}
      {poll.fixed_venue && <p>Fixed venue: {poll.fixed_venue}</p>}
      <p className="plan-muted">
        {closed
          ? "Voting and suggestions are closed."
          : "Select every option that works for you. Votes can change until closing."}
      </p>
      <div className="plan-grid">
        {(["date", "venue"] as const)
          .filter((k) => poll.scope === "both" || poll.scope === k)
          .map((k) => (
            <fieldset key={k}>
              <legend>
                {k === "date" ? "When · Date & time" : "Where · Venue"}
              </legend>
              {poll.options
                .filter((o) => o.kind === k)
                .map((o) => (
                  <div key={o.id}>
                    <label className="plan-option">
                      <input
                        type="checkbox"
                        checked={!o.withdrawn && shown.includes(o.id)}
                        disabled={closed || o.withdrawn}
                        onChange={(e) => select(o.id, e.target.checked)}
                      />
                      <span>
                        <strong>{optionLabel(o)}</strong>
                        <small>
                          {o.withdrawn
                            ? "Withdrawn"
                            : !organizer && !closed
                              ? (o.suggestion ? "Member suggestion" : "Organizer option")
                            : o.suggested_by
                              ? `Suggested by ${o.suggested_by === userId ? "you" : formatPlayerName(o.author?.display_name, o.author?.first_name, o.author?.include_first_name_in_display)}`
                              : "Organizer option"}
                          {o.detail ? ` · ${o.detail}` : ""}
                        </small>
                      </span>
                      <span className="plan-option-actions">
                        {organizer || closed ? (o.votes === null ? "Refresh to see results" : `${o.votes} ${o.votes === 1 ? "vote" : "votes"}`) : "Results after voting closes"}
                      </span>
                    </label>
                    {!closed && !o.withdrawn && (o.is_mine ?? o.suggested_by === userId) && (
                      <ActionButton
                        onClick={() =>
                          void change("withdraw", {
                            poll_id: poll.id,
                            option_id: o.id,
                          })
                        }
                      >
                        Withdraw {optionLabel(o)}
                      </ActionButton>
                    )}
                  </div>
                ))}
            </fieldset>
          ))}
      </div>
      {!closed && (
        <div className="plan-head plan-divider">
          <div className="plan-row">
            <ActionButton
              variant="primary"
              disabled={stale}
              onClick={async () => {
                if (
                  await change("vote", {
                    poll_id: poll.id,
                    revision: dirty ? ballotRevision : poll.ballot_revision,
                    options: shown.filter((id) =>
                      poll.options.some((o) => o.id === id && !o.withdrawn),
                    ),
                  })
                ) {
                  setDirty(false);
                }
              }}
            >
              Save my votes
            </ActionButton>
            <span className="plan-muted">
              {dirty
                ? "Unsaved choices"
                : poll.mine.length
                  ? "Your votes are saved"
                  : "No vote saved"}
            </span>
          </div>
          <div className="plan-row">
            <ActionButton
              disabled={poll.suggestions_used >= 2}
              onClick={() => setSuggest((v) => !v)}
            >
              Suggest an option
            </ActionButton>
            <span className="plan-muted">
              {poll.suggestions_used} of 2 suggestions used
            </span>
          </div>
        </div>
      )}
      {stale && (
        <p className="night-warning">
          Your ballot changed on another device.{" "}
          <ActionButton
            onClick={() => {
              setSelected(poll.mine);
              setBallotRevision(poll.ballot_revision);
              setDirty(false);
            }}
          >
            Load my saved ballot
          </ActionButton>
        </p>
      )}
      {!closed && suggest && (
        <form
          className="plan-form plan-divider"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await change("suggest", {
                poll_id: poll.id,
                kind,
                starts_local: kind === "date" ? starts : null,
                venue: kind === "venue" ? venue : null,
                detail,
              })
            ) {
              setSuggest(false);
              setStarts("");
              setVenue("");
              setDetail("");
            }
          }}
        >
          <h3>Add your suggestion</h3>
          <label>
            Suggest a
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as "date" | "venue")}
            >
              {poll.scope !== "venue" && (
                <option value="date">Date & time</option>
              )}
              {poll.scope !== "date" && <option value="venue">Venue</option>}
            </select>
          </label>
          {kind === "date" ? (
            <label>
              Date & time (Rochester time)
              <input
                type="datetime-local"
                required
                value={starts}
                onChange={(e) => setStarts(e.target.value)}
              />
            </label>
          ) : (
            <label>
              Venue name
              <input
                maxLength={49}
                required
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            </label>
          )}
          <label>
            Short detail (optional)
            <input
              maxLength={100}
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
            />
          </label>
          <p className="plan-muted">
            Two suggestions total across both categories. Withdrawing an option
            does not restore a slot. Adding an option does not vote for it.
          </p>
          <div className="plan-row">
            <ActionButton variant="primary" type="submit">Add suggestion</ActionButton>
            <ActionButton type="button" onClick={() => setSuggest(false)}>
              Cancel suggestion
            </ActionButton>
          </div>
        </form>
      )}
      {poll.night_id && (
        <ActionLink
          className="plan-link"
          href={`/league-night?night=${poll.night_id}`}
        >
          Open the confirmed night →
        </ActionLink>
      )}
      {organizer && (
        <details>
          <summary>Organizer controls</summary>
          <div className="plan-row">
            {poll.status === "draft" && (
              <ActionButton onClick={() => edit(false)}>Edit / publish draft</ActionButton>
            )}
            {poll.status === "open" && !closed && (
              <ActionButton onClick={() => setConfirm("close_poll")}>
                Close voting now
              </ActionButton>
            )}
            {(poll.status === "closed" ||
              (poll.status === "open" && closed)) && (
              <ActionButton variant="primary" onClick={schedule}>
                Review results & schedule
              </ActionButton>
            )}
            <ActionButton onClick={() => edit(true)}>Copy to new draft</ActionButton>
            {!["scheduled", "cancelled"].includes(poll.status) && (
              <ActionButton onClick={() => setConfirm("cancel_poll")}>
                Cancel poll
              </ActionButton>
            )}
          </div>
          {confirm && (
            <div className="plan-notice">
              <p>
                {confirm === "close_poll"
                  ? "Close voting now? No more votes or suggestions can be added."
                  : "Cancel this poll? Its history will be kept."}
              </p>
              <div className="plan-row">
                <ActionButton
                  onClick={async () => {
                    if (
                      await change(confirm, {
                        poll_id: poll.id,
                        revision: poll.revision,
                      })
                    )
                      setConfirm(null);
                  }}
                >
                  Confirm {confirm === "close_poll" ? "close" : "cancellation"}
                </ActionButton>
                <ActionButton onClick={() => setConfirm(null)}>Keep poll</ActionButton>
              </div>
            </div>
          )}
        </details>
      )}
    </article>
  );
}
