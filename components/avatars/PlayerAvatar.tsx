"use client";
import Image from "next/image";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUser } from "@/lib/league-night/use-current-user";
import { avatarById, initials } from "@/lib/rivalries/catalog";
import type { AvatarChoice } from "@/lib/rivalries/types";
const Choices = createContext<Record<string, AvatarChoice>>({});
export const AVATAR_CHANGED = "rdd-avatar-changed";
export function AvatarProvider({ children }: { children: ReactNode }) {
  const { user } = useCurrentUser();
  return (
    <AvatarStore key={user?.id ?? "signed-out"} user={user?.id}>
      {children}
    </AvatarStore>
  );
}
function AvatarStore({
  user,
  children,
}: {
  user?: string;
  children: ReactNode;
}) {
  const [choices, setChoices] = useState<Record<string, AvatarChoice>>({});
  useEffect(() => {
    if (!user) return;
    let active = true;
    let generation = 0;
    async function refresh() {
      const current = ++generation;
      try {
        const rows: AvatarChoice[] = [];
        let total = 1;
        for (let offset = 0; offset < total; offset += 500) {
          const { data, error } = await supabase.rpc("rdd_avatar_read", {
            p_offset: offset,
          });
          if (error) throw error;
          if (
            !data ||
            !Array.isArray(data.avatars) ||
            !Number.isSafeInteger(data.total) ||
            (offset > 0 && data.total !== total)
          )
            throw Error("Incomplete avatars");
          total = data.total;
          rows.push(...data.avatars);
        }
        if (active && current === generation)
          setChoices(Object.fromEntries(rows.map((a) => [a.user_id, a])));
      } catch (cause) {
        if (
          active &&
          current === generation &&
          (cause as { code?: string })?.code === "42501"
        )
          setChoices({});
      }
    }
    void refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener(AVATAR_CHANGED, refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      window.removeEventListener(AVATAR_CHANGED, refresh);
    };
  }, [user]);
  return <Choices.Provider value={choices}>{children}</Choices.Provider>;
}
export function useAvatarChoice(id: string) {
  return useContext(Choices)[id];
}
export function PlayerAvatar({
  playerId,
  name,
  avatarId,
  size = 48,
  portrait = false,
  flip = false,
}: {
  playerId?: string;
  name: string;
  avatarId?: string | null;
  size?: number;
  portrait?: boolean;
  flip?: boolean;
}) {
  const choices = useContext(Choices);
  const avatar = avatarById(
    avatarId === undefined ? choices[playerId ?? ""]?.avatar_id : avatarId,
  );
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const imageSource = avatar
    ? portrait
      ? avatar.image
      : size > 64
        ? avatar.medium
        : avatar.thumbnail
    : null;
  return (
    <span
      className={`player-avatar ${portrait ? "player-portrait" : ""}`}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        flexShrink: 0,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderRadius: portrait ? "0" : "50%",
        background: portrait ? "transparent" : "#182334",
        color: "#fff",
        fontWeight: 900,
        fontSize: Math.max(14, size / 3),
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    >
      {avatar && imageSource !== failedSource ? (
        <Image
          src={imageSource!}
          alt={portrait ? `${name} · ${avatar.label}` : ""}
          width={portrait ? 512 : 96}
          height={portrait ? 512 : 96}
          priority={portrait}
          unoptimized
          onError={() => setFailedSource(imageSource)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : (
        <span
          aria-label={portrait ? `${name}, initials avatar` : undefined}
          style={{ transform: flip ? "scaleX(-1)" : undefined }}
        >
          {initials(name)}
        </span>
      )}
    </span>
  );
}
