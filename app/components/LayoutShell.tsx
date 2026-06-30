"use client";

import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import SummerOverlay from "./SummerOverlay";

const STORAGE_KEY = "summer-overlay-enabled";

type LayoutShellProps = {
  children: React.ReactNode;
};

export default function LayoutShell({ children }: LayoutShellProps) {
  const [summerEnabled, setSummerEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(summerEnabled));
  }, [summerEnabled]);

  return (
    <>
      {summerEnabled && <SummerOverlay />}
      <Navbar
        summerEnabled={summerEnabled}
        onToggleSummer={() => setSummerEnabled((prev) => !prev)}
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
