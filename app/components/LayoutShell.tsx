"use client";

import React, { useEffect, useState } from "react";
import Navbar from "./Navbar";
import Snowfall from "./Snowfall";

const STORAGE_KEY = "snowfall-enabled";

type LayoutShellProps = {
  children: React.ReactNode;
};

export default function LayoutShell({ children }: LayoutShellProps) {
  const [snowEnabled, setSnowEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === null ? true : stored === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(snowEnabled));
  }, [snowEnabled]);

  return (
    <>
      {snowEnabled && <Snowfall />}
      <Navbar
        snowEnabled={snowEnabled}
        onToggleSnow={() => setSnowEnabled((prev) => !prev)}
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
