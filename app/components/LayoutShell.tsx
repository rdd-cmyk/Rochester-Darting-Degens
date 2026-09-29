"use client";

import React, { Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "./Navbar";
import SummerOverlay from "./SummerOverlay";

const STORAGE_KEY = "summer-overlay-enabled";
const CHANGE_EVENT = "rdd-summer-preference-change";

function subscribeSummerPreference(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(CHANGE_EVENT, listener);
  };
}

function getSummerPreference() {
  return localStorage.getItem(STORAGE_KEY) !== "false";
}

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

  // The server snapshot matches the first client render, then the saved
  // preference takes over after hydration without writing a default over it.
  const summerEnabled = useSyncExternalStore(
    subscribeSummerPreference,
    getSummerPreference,
    () => true
  );

  function toggleSummer() {
    localStorage.setItem(STORAGE_KEY, String(!summerEnabled));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  return (
    <>
      {process.env.NEXT_PUBLIC_RDD_VISUAL_FIXTURE === "1" && (
        <Suspense fallback={null}><LocalVisualTheme /></Suspense>
      )}
      <a className="site-skip-link" href="#main-content">Skip to content</a>
      {summerEnabled && <SummerOverlay />}
      <Navbar
        summerEnabled={summerEnabled}
        onToggleSummer={toggleSummer}
      />

      {/* Main page content */}
      <div className="site-content" id="main-content" tabIndex={-1}>{children}</div>

      {/* Global footer */}
      <footer className="site-footer">
        Powered by good vibes, man 😎✌️
      </footer>
    </>
  );
}
