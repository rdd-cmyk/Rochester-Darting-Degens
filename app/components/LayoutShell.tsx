"use client";

import React, { useSyncExternalStore } from "react";
import Navbar from "./Navbar";
import SummerOverlay from "./SummerOverlay";

const STORAGE_KEY = "summer-overlay-enabled";
const PREFERENCE_EVENT = "rdd-summer-preference";
let fallbackSummer = true;
let unsavedSummer: boolean | undefined;
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCE_EVENT, callback);
  };
}
function readPreference() {
  if (unsavedSummer !== undefined) return unsavedSummer;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return fallbackSummer;
  }
}
const serverPreference = () => true;

type LayoutShellProps = {
  children: React.ReactNode;
};

export default function LayoutShell({ children }: LayoutShellProps) {
  // The server snapshot also supplies the first hydration render. Reading a
  // saved Off preference before hydration caused a server/client text mismatch.
  const summerEnabled = useSyncExternalStore(
    subscribe,
    readPreference,
    serverPreference,
  );
  function toggleSummer() {
    fallbackSummer = !summerEnabled;
    try {
      localStorage.setItem(STORAGE_KEY, String(fallbackSummer));
      unsavedSummer = undefined;
    } catch {
      unsavedSummer = fallbackSummer;
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }

  return (
    <>
      {summerEnabled && <SummerOverlay />}
      <Navbar summerEnabled={summerEnabled} onToggleSummer={toggleSummer} />

      {/* Main page content */}
      <div style={{ flex: 1 }}>{children}</div>

      {/* Global footer */}
      <footer
        style={{
          padding: "1rem",
          textAlign: "center",
          borderTop: "1px solid #ddd",
          fontFamily: "sans-serif",
          color: "#555",
        }}
      >
        Powered by good vibes, man 😎✌️
      </footer>
    </>
  );
}
