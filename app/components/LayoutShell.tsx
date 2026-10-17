"use client";

import React, { Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "./Navbar";
import SeasonalOverlay from "./SeasonalOverlay";
import { getSeason, SEASON_LABELS } from "@/lib/season";

function subscribeSeason(callback: () => void) {
  // Align checks to minute boundaries, including midnight Eastern Time.
  let timer: ReturnType<typeof setTimeout>;
  const tick = () => {
    callback();
    timer = setTimeout(tick, 60_000 - Date.now() % 60_000);
  };
  timer = setTimeout(tick, 60_000 - Date.now() % 60_000);
  window.addEventListener("focus", callback);
  document.addEventListener("visibilitychange", callback);
  return () => {
    clearTimeout(timer);
    window.removeEventListener("focus", callback);
    document.removeEventListener("visibilitychange", callback);
  };
}
const serverSeason = () => null;


const STORAGE_KEY = "seasonal-overlay-enabled";
// Keep the previous opt-out until the visitor next changes their preference.
const LEGACY_STORAGE_KEY = "summer-overlay-enabled";
const PREFERENCE_EVENT = "rdd-seasonal-preference";
let fallbackSeasonal = true;
let unsavedSeasonal: boolean | undefined;
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCE_EVENT, callback);
  };
}
function readPreference() {
  if (unsavedSeasonal !== undefined) return unsavedSeasonal;
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    return stored === null ? true : stored === "true";
  } catch {
    return fallbackSeasonal;
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
  const season = useSyncExternalStore(subscribeSeason, getSeason, serverSeason);
  // The server snapshot also supplies the first hydration render. Reading a
  // saved Off preference before hydration caused a server/client text mismatch.
  const seasonalEnabled = useSyncExternalStore(
    subscribe,
    readPreference,
    serverPreference,
  );
  function toggleSeasonal() {
    fallbackSeasonal = !seasonalEnabled;
    try {
      localStorage.setItem(STORAGE_KEY, String(fallbackSeasonal));
      unsavedSeasonal = undefined;
    } catch {
      unsavedSeasonal = fallbackSeasonal;
    }
    window.dispatchEvent(new Event(PREFERENCE_EVENT));
  }

  return (
    <>
      {process.env.NEXT_PUBLIC_RDD_VISUAL_FIXTURE === "1" && (
        <Suspense fallback={null}><LocalVisualTheme /></Suspense>
      )}
      <a className="site-skip-link" href="#main-content">Skip to content</a>
      {seasonalEnabled && season && <SeasonalOverlay season={season} />}
      <Navbar seasonalEnabled={seasonalEnabled} onToggleSeasonal={toggleSeasonal}
        seasonLabel={season ? SEASON_LABELS[season] : "Seasonal"} />

      {/* Main page content */}
      <div className="site-content" id="main-content" tabIndex={-1}>{children}</div>

      {/* Global footer */}
      <footer className="site-footer">
        Powered by good vibes, man 😎✌️
      </footer>
    </>
  );
}
