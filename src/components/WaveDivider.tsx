import type { ReactElement } from "react";

/** Decorative organic wave divider between page sections. */
export function WaveDivider(): ReactElement {
  return (
    <svg
      className="wave-divider"
      viewBox="0 0 720 22"
      preserveAspectRatio="none"
      role="presentation"
      aria-hidden="true"
    >
      <path
        d="M0 12 C 90 2, 180 22, 300 12 S 520 2, 620 12 S 700 18, 720 10 L 720 22 L 0 22 Z"
        fill="var(--ts-sand)"
      />
      <path
        d="M0 16 C 120 6, 240 24, 380 14 S 600 8, 720 16"
        fill="none"
        stroke="var(--ts-teal)"
        strokeOpacity="0.35"
        strokeWidth="1.5"
      />
    </svg>
  );
}
