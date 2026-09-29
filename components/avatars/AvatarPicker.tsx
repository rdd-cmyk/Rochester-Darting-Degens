"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AVATARS } from "@/lib/rivalries/catalog";
import { rivalryError } from "@/lib/rivalries/api";
import { useRivalryOperation } from "@/lib/rivalries/use-operation";
import { AVATAR_CHANGED, PlayerAvatar } from "./PlayerAvatar";
export function AvatarPicker({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const mounted = useRef(false);
  const op = useRivalryOperation(userId, "avatar", (receipt) => {
    if (receipt.avatar) {
      setSelected(receipt.avatar.avatar_id);
      setRevision(receipt.avatar.revision);
      setMessage("Your player avatar is saved.");
      window.dispatchEvent(new Event(AVATAR_CHANGED));
    }
  });
  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("rdd_avatar_self");
      if (error) throw error;
      if (
        !data ||
        !Number.isSafeInteger(data.revision) ||
        data.user_id !== userId
      )
        throw Error("Avatar details were interrupted.");
      if (mounted.current) {
        setSelected(data.avatar_id);
        setRevision(data.revision);
        setError("");
      }
    } catch (cause) {
      if (mounted.current) setError(rivalryError(cause));
    }
  }, [userId]);
  useEffect(() => {
    mounted.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the owner's remote avatar after hydration.
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  const locked = op.busy || !!op.pending || revision === null || !op.ready;
  return (
    <section className="avatar-picker" aria-labelledby="avatar-title">
      <div className="avatar-picker-heading">
        <PlayerAvatar name={name} avatarId={selected} size={80} />
        <div>
          <h2 id="avatar-title">Your player avatar</h2>
          <p>Pick your personality. Bring it to every matchup.</p>
        </div>
      </div>
      <div
        className="avatar-grid"
        role="group"
        aria-label="Player avatar choices"
      >
        <button
          type="button"
          aria-pressed={selected === null}
          disabled={locked}
          onClick={() => {
            setSelected(null);
            setMessage("");
          }}
        >
          <PlayerAvatar name={name} avatarId={null} />
          <span>Initials</span>
        </button>
        {AVATARS.map((a) => (
          <button
            type="button"
            key={a.id}
            aria-pressed={selected === a.id}
            disabled={locked}
            onClick={() => {
              setSelected(a.id);
              setMessage("");
            }}
          >
            <PlayerAvatar name={name} avatarId={a.id} size={64} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="rr-primary"
        disabled={locked}
        onClick={() =>
          void op.submit({
            action: "avatar",
            avatar_id: selected,
            expected_revision: revision,
          })
        }
      >
        Save avatar
      </button>
      {op.pending && (
        <div role="status">
          <p>
            An avatar save needs confirmation. Check the same attempt before
            choosing again.
          </p>
          <button disabled={op.busy} onClick={() => void op.submit()}>
            Check avatar save
          </button>
        </div>
      )}
      {(error || op.error) && <p role="alert">{error || op.error}</p>}
      {message && <p role="status">{message}</p>}
      {(error || op.error) && (
        <button
          disabled={op.busy || !!op.pending}
          onClick={() => void refresh()}
        >
          Refresh avatar details
        </button>
      )}
    </section>
  );
}
