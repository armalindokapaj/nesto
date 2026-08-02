// Original abstract line-art motif (grid + structural diagonals) evoking
// architectural drafting without reproducing any specific building — sits
// faint behind the landing headline, per the approved reference's mood.
export function BlueprintMotif({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 480"
      className={className}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 60} x2="480" y2={i * 60} opacity="0.5" />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 60} y1="0" x2={i * 60} y2="480" opacity="0.5" />
      ))}
      <path d="M40 440 L40 220 L160 220 L160 120 L320 120 L320 440" strokeWidth="1.5" />
      <path d="M160 220 L160 440" strokeWidth="1.5" />
      <path d="M240 120 L240 440" strokeWidth="1.5" />
      <path d="M40 300 L320 300" strokeWidth="1.5" />
      <path d="M40 360 L320 360" strokeWidth="1.5" />
      <circle cx="160" cy="220" r="4" />
      <circle cx="320" cy="120" r="4" />
    </svg>
  );
}
