"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { AVATARS } from "@/lib/rivalries/catalog";
import { rivalryError } from "@/lib/rivalries/api";
import { useRivalryOperation } from "@/lib/rivalries/use-operation";
import { AVATAR_CHANGED, PlayerAvatar } from "./PlayerAvatar";
import { ActionButton } from "@/components/ui/ActionButton";
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
      setMessage(
        receipt.avatar_superseded
          ? "Your earlier save is confirmed. Showing your latest avatar from a later save."
          : "Your player avatar is saved.",
      );
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
    <section className="rdd-content-panel account-avatar-picker" aria-labelledby="avatar-title" aria-busy={op.busy}>
      <div className="account-avatar-heading">
        <PlayerAvatar name={name} avatarId={selected} size={80} />
        <div>
          <h2 id="avatar-title" className="rdd-section-title">Your player avatar</h2>
          <p>Pick your personality. Bring it to every matchup.</p>
        </div>
      </div>
      <div
        className="account-avatar-grid"
        role="group"
        aria-label="Player avatar choices"
      >
        <ActionButton
          type="button"
          aria-pressed={selected === null}
          disabled={locked}
          onClick={() => {
            setSelected(null);
            setMessage("");
          }}
        >
          <span aria-hidden="true"><PlayerAvatar name={name} avatarId={null} /></span>
          <span>Initials</span>
        </ActionButton>
        {AVATARS.map((a) => (
          <ActionButton
            type="button"
            key={a.id}
            aria-pressed={selected === a.id}
            disabled={locked}
            onClick={() => {
              setSelected(a.id);
              setMessage("");
            }}
          >
            <span aria-hidden="true"><PlayerAvatar name={name} avatarId={a.id} size={64} /></span>
            <span>{a.label}</span>
          </ActionButton>
        ))}
      </div>
      <ActionButton
        type="button"
        variant="primary"
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
      </ActionButton>
      {op.pending && (
        <div role="status">
          <p>
            An avatar save needs confirmation. Check the same attempt before
            choosing again.
          </p>
          <ActionButton disabled={op.busy} onClick={() => void op.submit()}>
            Check avatar save
          </ActionButton>
        </div>
      )}
      {(error || op.error) && <p role="alert">{error || op.error}</p>}
      {message && <p role="status">{message}</p>}
      {(error || op.error) && (
        <ActionButton
          disabled={op.busy || !!op.pending}
          onClick={() => void refresh()}
        >
          Refresh avatar details
        </ActionButton>
      )}
    </section>
  );
}
