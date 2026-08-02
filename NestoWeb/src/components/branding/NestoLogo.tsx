import { cn } from "@/lib/utils";

type NestoLogoProps = {
  variant?: "mark" | "full";
  className?: string;
  markClassName?: string;
  size?: number;
};

// Nesto brand mark: an abstracted "N" built from three nested chevrons —
// evokes a nest (layered, protective) and the letterform at once. Single
// gold stroke on transparent background so it drops onto any surface
// (nav, favicon, auth card, print/PDF exports) without a background plate.
export function NestoMark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Nesto"
    >
      <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 27V13L28 27V13"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NestoLogo({ variant = "full", className, markClassName, size = 32 }: NestoLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NestoMark size={size} className={cn("text-gold shrink-0", markClassName)} />
      {variant === "full" && (
        <span className="font-serif text-[1.35rem] leading-none tracking-tight text-ink">
          Nesto
        </span>
      )}
    </span>
  );
}
