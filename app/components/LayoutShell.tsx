"use client";

import React, { useSyncExternalStore } from "react";
import Navbar from "./Navbar";
import SummerOverlay from "./SummerOverlay";

const STORAGE_KEY = "summer-overlay-enabled";
const SETTING_EVENT = "rdd-summer-setting";
let fallbackSummerEnabled = true;

function readSummerSetting() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? fallbackSummerEnabled : stored === "true";
  } catch { return fallbackSummerEnabled; }
}

function subscribeSummerSetting(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(SETTING_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SETTING_EVENT, onChange);
  };
}

// Match the server during hydration, then apply the browser's saved preference.
const serverSummerSetting = () => true;

type LayoutShellProps = {
  children: React.ReactNode;
};

export default function LayoutShell({ children }: LayoutShellProps) {
  const summerEnabled = useSyncExternalStore(subscribeSummerSetting, readSummerSetting, serverSummerSetting);
  function toggleSummer() {
    fallbackSummerEnabled = !summerEnabled;
    try { localStorage.setItem(STORAGE_KEY, String(fallbackSummerEnabled)); } catch { /* Keep the switch usable when storage is blocked. */ }
    window.dispatchEvent(new Event(SETTING_EVENT));
  }

  return (
    <>
      {summerEnabled && <SummerOverlay />}
      <Navbar
        summerEnabled={summerEnabled}
        onToggleSummer={toggleSummer}
      />

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
