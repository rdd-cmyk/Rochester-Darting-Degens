"use client";

import React from "react";

const SNOWFLAKES = Array.from({ length: 48 }, (_, index) => {
  const left = (index * 19) % 100; // deterministic spread across the viewport
  const size = 8 + ((index * 7) % 10);
  const delay = (index * 73) % 18;
  const duration = 12 + ((index * 5) % 10);
  const drift = ((index % 2 === 0 ? 1 : -1) * (6 + (index % 6))) * 2;
  const opacity = 0.45 + ((index * 11) % 30) / 100;

  return { left, size, delay, duration, drift, opacity };
});

function SnowflakeLayer() {
  return (
    <div className="snowfall" aria-hidden>
      {SNOWFLAKES.map((flake, idx) => (
        <span
          key={idx}
          className="snowflake"
          style={{
            left: `${flake.left}%`,
            fontSize: `${flake.size}px`,
            animationDelay: `-${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
            opacity: flake.opacity,
            ["--drift" as string]: `${flake.drift}px`,
          }}
        >
          ❄
        </span>
      ))}
    </div>
  );
}

export default function Snowfall() {
  return (
    <>
      <SnowflakeLayer />
      <SnowflakeLayer />
    </>
  );
}
