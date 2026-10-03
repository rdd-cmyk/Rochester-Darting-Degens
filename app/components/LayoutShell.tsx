"use client";

import React, { Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
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

function LocalVisualTheme() {
  const searchParams = useSearchParams();
  const light = searchParams.get("qaTheme") === "light";

  useEffect(() => {
    if (light) document.documentElement.dataset.qaTheme = "light";
    else delete document.documentElement.dataset.qaTheme;
    return () => { delete document.documentElement.dataset.qaTheme; };
  }, [light]);

  return null;
}

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
      {process.env.NEXT_PUBLIC_RDD_VISUAL_FIXTURE === "1" && (
        <Suspense fallback={null}><LocalVisualTheme /></Suspense>
      )}
      <a className="site-skip-link" href="#main-content">Skip to content</a>
      {summerEnabled && <SummerOverlay />}
      <Navbar summerEnabled={summerEnabled} onToggleSummer={toggleSummer} />

      {/* Main page content */}
      <div className="site-content" id="main-content" tabIndex={-1}>{children}</div>

      {/* Global footer */}
      <footer className="site-footer">
        Powered by good vibes, man 😎✌️
      </footer>
    </>
  );
}
