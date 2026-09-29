"use client";
import { useEffect, useRef, useState } from "react";
import {
  definiteRejection,
  operationKey,
  readPending,
  readRecovery,
  rivalryError,
  rivalryWrite,
  type PendingAction,
} from "./api";
import type { RivalryReceipt, RivalryRequest } from "./types";
/** Never replace a possibly committed operation with an edited payload. */
export function useRivalryOperation(
  user: string,
  scope: string,
  onConfirmed: (receipt: RivalryReceipt) => void,
) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(false);
  const callback = useRef(onConfirmed);
  const key = operationKey(user, scope);
  useEffect(() => {
    callback.current = onConfirmed;
  }, [onConfirmed]);
  useEffect(() => {
    mounted.current = true;
    try {
      const saved = readRecovery(localStorage, key, user);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Hydrate durable browser recovery state after mounting.
      setPending(saved);
      setReady(true);
    } catch {
      setError(
        "Recovery storage is unavailable. Enable browser storage before saving.",
      );
    }
    const changed = (e: StorageEvent) => {
      if (e.key === key || e.key?.startsWith(key + ":op:")) {
        try {
          setPending(readRecovery(localStorage, key, user));
        } catch {
          /* Keep the current attempt. */
        }
      }
    };
    window.addEventListener("storage", changed);
    return () => {
      mounted.current = false;
      window.removeEventListener("storage", changed);
    };
  }, [key, user]);
  async function submit(payload?: Omit<RivalryRequest, "submitted_by">) {
    if (lock.current || !ready) return;
    const attempt =
      pending ??
      (payload
        ? {
            id: crypto.randomUUID(),
            createdAt: Date.now(),
            payload: { ...payload, submitted_by: user } as RivalryRequest,
          }
        : null);
    if (!attempt) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setPending(attempt);
    try {
      // Persist before dispatch. If storage fails, no request is sent.
      const stored = readRecovery(localStorage, key, user);
      if (stored && stored.id !== attempt.id) {
        setPending(stored);
        throw Error(
          "Another tab has an unfinished action. Check that action first.",
        );
      }
      localStorage.setItem(`${key}:op:${attempt.id}`, JSON.stringify(attempt));
      localStorage.setItem(key, JSON.stringify(attempt));
      const result = await rivalryWrite(attempt.id, attempt.payload);
      const current = readPending(localStorage.getItem(key), user);
      if (current?.id === attempt.id) localStorage.removeItem(key);
      localStorage.removeItem(`${key}:op:${attempt.id}`);
      if (mounted.current) {
        setPending(readRecovery(localStorage, key, user));
        callback.current(result);
      }
    } catch (cause) {
      if (definiteRejection(cause)) {
        try {
          if (readPending(localStorage.getItem(key), user)?.id === attempt.id)
            localStorage.removeItem(key);
          localStorage.removeItem(`${key}:op:${attempt.id}`);
        } catch {
          /* Request was definitely rejected. */
        }
        if (mounted.current) setPending(readRecovery(localStorage, key, user));
      }
      if (mounted.current) setError(rivalryError(cause));
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { submit, pending, busy, error, ready };
}
