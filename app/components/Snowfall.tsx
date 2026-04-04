"use client";

import React from "react";

const EASTER_ICONS = ["🐰", "🌷", "🐣"] as const;

const EASTER_PARTICLES = Array.from({ length: 48 }, (_, index) => {
  const left = (index * 19) % 100; // deterministic spread across the viewport
  const size = 14 + ((index * 7) % 10);
  const delay = (index * 73) % 18;
  const duration = 13 + ((index * 5) % 10);
  const drift = ((index % 2 === 0 ? 1 : -1) * (6 + (index % 6))) * 2;
  const opacity = 0.6 + ((index * 11) % 28) / 100;
  const icon = EASTER_ICONS[index % EASTER_ICONS.length];

  return { left, size, delay, duration, drift, opacity, icon };
});

function SnowflakeLayer() {
  return (
    <div className="snowfall" aria-hidden>
      {EASTER_PARTICLES.map((particle, idx) => (
        <span
          key={idx}
          className="snowflake"
          style={{
            left: `${particle.left}%`,
            fontSize: `${particle.size}px`,
            animationDelay: `-${particle.delay}s`,
            animationDuration: `${particle.duration}s`,
            opacity: particle.opacity,
            ["--drift" as string]: `${particle.drift}px`,
          }}
        >
          {particle.icon}
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
