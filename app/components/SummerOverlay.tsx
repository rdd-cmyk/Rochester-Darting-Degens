"use client";

import React from "react";

const SUMMER_ICONS = ["☀️", "🌴", "🍉", "🕶️", "🌺"] as const;

const SUMMER_PARTICLES = Array.from({ length: 42 }, (_, index) => {
  const left = (index * 23) % 100; // deterministic spread across the viewport
  const size = 16 + ((index * 7) % 12);
  const delay = (index * 79) % 20;
  const duration = 15 + ((index * 5) % 11);
  const drift = ((index % 2 === 0 ? 1 : -1) * (8 + (index % 7))) * 2;
  const opacity = 0.55 + ((index * 13) % 30) / 100;
  const icon = SUMMER_ICONS[index % SUMMER_ICONS.length];

  return { left, size, delay, duration, drift, opacity, icon };
});

function SummerParticleLayer() {
  return (
    <div className="summer-overlay" aria-hidden>
      {SUMMER_PARTICLES.map((particle, idx) => (
        <span
          key={idx}
          className="summer-particle"
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

export default function SummerOverlay() {
  return (
    <>
      <SummerParticleLayer />
      <SummerParticleLayer />
    </>
  );
}
