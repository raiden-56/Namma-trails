/**
 * Layered SVG compositions in palette tones that stand in for licensed photography.
 * Purely decorative (the parent carries the accessible label).
 */
export type SceneName = "coast" | "backwater" | "hills" | "temple" | "road" | "forest";

const palettes: Record<SceneName, { sky: [string, string]; sun: string; far: string; mid: string; near: string; sea: [string, string] }> = {
  coast: { sky: ["#f3d9b0", "#e9a77c"], sun: "#f6e3a3", far: "#b9a58a", mid: "#7f8a6a", near: "#3e4a33", sea: ["#8fb0ab", "#4f7b7e"] },
  backwater: { sky: ["#e8e3cf", "#c9cfb6"], sun: "#f3e7b8", far: "#a7ae91", mid: "#6f7d5a", near: "#33402b", sea: ["#9fb8b6", "#5f8784"] },
  hills: { sky: ["#efe0c4", "#d9c9af"], sun: "#ebcb79", far: "#b8b39a", mid: "#8b8f70", near: "#4b5139", sea: ["#c9c2a8", "#9e9a82"] },
  temple: { sky: ["#f5d4a6", "#e65b3f"], sun: "#f8e4ae", far: "#c98b62", mid: "#8a4b33", near: "#3a231a", sea: ["#e2b48c", "#a75f3f"] },
  road: { sky: ["#f1e6d0", "#d9c9af"], sun: "#ebcb79", far: "#b3ab92", mid: "#77736c", near: "#2a2620", sea: ["#cbbd9f", "#8d836e"] },
  forest: { sky: ["#e4e3cd", "#a7ae91"], sun: "#efe2b0", far: "#8e9a78", mid: "#5d6c48", near: "#26311f", sea: ["#9db08f", "#5f7552"] },
};

export function PlaceholderScene({ scene }: { scene: SceneName }) {
  const p = palettes[scene];
  const id = `scene-${scene}`;
  const showSea = scene === "coast" || scene === "backwater" || scene === "temple";
  return (
    <svg viewBox="0 0 800 600" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="1" stopColor={p.sky[1]} />
        </linearGradient>
        <linearGradient id={`${id}-sea`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sea[0]} />
          <stop offset="1" stopColor={p.sea[1]} />
        </linearGradient>
      </defs>
      <rect width="800" height="600" fill={`url(#${id}-sky)`} />
      <circle cx="560" cy="250" r="70" fill={p.sun} opacity="0.9" />
      <path d="M0 330 C 120 270, 220 300, 320 280 S 520 230, 640 270 S 760 300, 800 290 V600 H0Z" fill={p.far} />
      <path d="M0 380 C 140 340, 260 370, 380 350 S 600 320, 800 360 V600 H0Z" fill={p.mid} />
      {showSea ? (
        <>
          <rect y="400" width="800" height="200" fill={`url(#${id}-sea)`} />
          {[430, 465, 505, 550].map((y, i) => (
            <path key={y} d={`M0 ${y} Q 200 ${y - 6} 400 ${y} T 800 ${y}`} stroke="#fffdf8" strokeOpacity={0.35 - i * 0.06} strokeWidth="2" fill="none" />
          ))}
        </>
      ) : (
        <path d="M0 450 C 200 420, 420 470, 800 430 V600 H0Z" fill={p.near} opacity="0.85" />
      )}
      {scene === "temple" ? (
        <g fill={p.near}>
          <rect x="140" y="300" width="70" height="110" />
          <path d="M130 300 L175 210 L220 300Z" />
          <rect x="168" y="190" width="14" height="24" />
        </g>
      ) : null}
      {scene === "road" ? <path d="M330 600 L390 380 L410 380 L470 600Z" fill="#191713" opacity="0.6" /> : null}
      {scene === "coast" || scene === "backwater" || scene === "forest" ? (
        <g stroke={p.near} strokeWidth="7" fill="none" strokeLinecap="round">
          <path d="M120 600 C 130 520, 150 450, 190 390" />
          <path d="M190 390 C 160 370, 120 375, 95 395 M190 390 C 210 360, 250 355, 275 370 M190 390 C 185 355, 200 330, 225 320 M190 390 C 165 360, 150 335, 150 315" />
          <path d="M690 600 C 680 540, 665 490, 640 450" />
          <path d="M640 450 C 610 435, 585 440, 565 455 M640 450 C 660 425, 690 425, 712 440 M640 450 C 640 420, 655 400, 675 395" />
        </g>
      ) : null}
    </svg>
  );
}
