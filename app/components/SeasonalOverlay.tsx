"use client";

import React from "react";

import type { Season } from "@/lib/season";

const SEASON_ICONS: Record<Season, readonly string[]> = {
  spring: ["🌸", "🌷", "🦋"],
  summer: ["☀️", "🌴", "🍉"],
  fall: ["🍁", "🍂", "🎃", "🌰"],
  winter: ["❄️", "⛄", "🌲"],
};

function Dart() {
  return (
    <svg viewBox="0 0 40 40" width="1em" height="1em" focusable="false" aria-hidden="true">
      <path d="M9 6 21 9 25 19 17 23 7 17Z" fill="#fb923c" />
      <path d="M9 6 17 16 17 23M7 17 17 16 21 9" fill="none" stroke="#08264d" strokeWidth="1.5" />
      <path d="m17 16 12 14" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
      <path d="m24 24 7 8" stroke="#475569" strokeWidth="5" />
      <path d="m31 32 5 6" stroke="#94a3b8" strokeWidth="1.5" />
    </svg>
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, index) => {
  const left = (index * 23) % 100; // deterministic spread across the viewport
  const size = 20 + ((index * 7) % 12);
  const delay = (index * 79) % 20;
  const duration = 15 + ((index * 5) % 11);
  const drift = ((index % 2 === 0 ? 1 : -1) * (8 + (index % 7))) * 2;
  const opacity = 0.50 + ((index * 13) % 10) / 100;

  return { left, size, delay, duration, drift, opacity };
});

export default function SeasonalOverlay({ season }: { season: Season }) {
  const icons = SEASON_ICONS[season];
  return (
    <div className="seasonal-overlay" data-season={season} aria-hidden="true">
      {PARTICLES.map((particle, idx) => (
        <span
          key={idx}
          className="seasonal-particle"
          style={{
            left: `${particle.left}%`,
            ["--particle-size" as string]: `${particle.size}px`,
            animationDelay: `-${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            ["--particle-opacity" as string]: particle.opacity,
            ["--drift" as string]: `${particle.drift}px`,
          }}
        >
          {idx % 4 === 0 ? <Dart /> : icons[(idx - Math.floor(idx / 4) - 1) % icons.length]}
        </span>
      ))}
    </div>
  );
}
