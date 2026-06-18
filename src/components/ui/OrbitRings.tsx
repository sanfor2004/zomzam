'use client';

import React from 'react';

const OrbitRings = React.forwardRef<SVGSVGElement>(function OrbitRings(_, ref) {
  return (
    <svg
      ref={ref}
      aria-hidden="true"
      className="absolute z-0 pointer-events-none"
      style={{
        width: '1160px',
        height: '1160px',
        top: '50%',
        left: '50%',
        marginLeft: '-580px',
        marginTop: '-580px',
      }}
      viewBox="0 0 1160 1160"
      fill="none"
    >
      {/* ──────────────────────────────────────────────────────────
          DEVELOPMENT NAVIGATOR: ORBIT RINGS
          Contains: 3 arc circles (85% filled / 15% gap).
          Ring 1 CW 9s · Ring 2 CCW 14s · Ring 3 CW 20s.
          Rotation driven by CSS @keyframes (zero JS overhead).
          animationDuration set inline — the shared .ring-orbit-*
          classes set everything else.
          transform-box: fill-box makes transform-origin: center
          resolve to each circle's own center, not SVG (0,0).
          ────────────────────────────────────────────────────────── */}

      {/* Ring 1 — r 279 px, CW 9 s, opacity 0.25
          Circumference ≈ 1753 px → dasharray 1490 (85%) 263 (15%) */}
      <circle
        cx="580"
        cy="580"
        r="279"
        stroke="rgba(238,87,18,0.25)"
        strokeWidth="1"
        strokeDasharray="1490 263"
        className="ring-orbit-cw"
        style={{ animationDuration: '9s' }}
      />

      {/* Ring 2 — r 419 px, CCW 14 s, opacity 0.15
          Circumference ≈ 2633 px → dasharray 2238 (85%) 395 (15%) */}
      <circle
        cx="580"
        cy="580"
        r="419"
        stroke="rgba(238,87,18,0.15)"
        strokeWidth="1"
        strokeDasharray="2238 395"
        className="ring-orbit-ccw"
        style={{ animationDuration: '14s' }}
      />

      {/* Ring 3 — r 579 px, CW 20 s, opacity 0.08
          Circumference ≈ 3638 px → dasharray 3092 (85%) 546 (15%) */}
      <circle
        cx="580"
        cy="580"
        r="579"
        stroke="rgba(238,87,18,0.08)"
        strokeWidth="1"
        strokeDasharray="3092 546"
        className="ring-orbit-cw"
        style={{ animationDuration: '20s' }}
      />
    </svg>
  );
});

export default OrbitRings;
