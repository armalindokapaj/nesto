"use client";

import { useEffect, useRef, useState } from "react";
import { SignInFace } from "@/components/marketing/sign-in-face";
import { SignUpFace } from "@/components/marketing/sign-up-face";

const FACE_CLASSES =
  "absolute inset-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_8px_30px_rgba(26,29,35,0.06)] [backface-visibility:hidden]";

const MAX_TILT_DEG = 6;
const MAX_GLOW_SHIFT_PX = 26;

// Landing-page auth card. One fixed-size element for the whole session —
// clicking "Apply for sign up" never navigates away, it flips this same
// card in place (3D rotateY) while its ambient background crossfades to a
// second theme (see .auth-ambient-* in globals.css). "Back to Company sign
// in" flips it back to the exact original state.
//
// A separate tilt layer wraps the flipper so the mouse-driven parallax
// (fast, ~150ms) never fights the deliberate flip transition (slow, 650ms,
// see --motion-flip* in globals.css) — both are rotateY under the hood but
// live on different elements with different transition speeds, composing
// naturally since nested preserve-3d contexts stack.
export function AuthCard() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const tiltRef = useRef<HTMLDivElement>(null);
  const glowFrontRef = useRef<HTMLDivElement>(null);
  const glowBackRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const nx = (e.clientX / window.innerWidth) * 2 - 1; // -1..1
        const ny = (e.clientY / window.innerHeight) * 2 - 1;
        if (tiltRef.current) {
          tiltRef.current.style.transform = `rotateX(${(-ny * MAX_TILT_DEG).toFixed(2)}deg) rotateY(${(nx * MAX_TILT_DEG).toFixed(2)}deg)`;
        }
        const glowTransform = `translate(${(nx * MAX_GLOW_SHIFT_PX).toFixed(1)}px, ${(ny * MAX_GLOW_SHIFT_PX).toFixed(1)}px)`;
        if (glowFrontRef.current) glowFrontRef.current.style.transform = glowTransform;
        if (glowBackRef.current) glowBackRef.current.style.transform = glowTransform;
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative w-[350px] max-w-full h-[480px] [perspective:1400px]">
      <div ref={glowFrontRef} className={`auth-ambient auth-ambient-signin ${mode === "signin" ? "opacity-100" : "opacity-0"}`} />
      <div ref={glowBackRef} className={`auth-ambient auth-ambient-signup ${mode === "signup" ? "opacity-100" : "opacity-0"}`} />

      <div
        ref={tiltRef}
        className="relative h-full w-full [transform-style:preserve-3d] transition-transform duration-150 ease-out"
      >
        <div
          className="relative h-full w-full [transform-style:preserve-3d] transition-transform duration-[var(--motion-flip)] ease-[var(--motion-flip-ease)]"
          style={{ transform: mode === "signup" ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <div className={FACE_CLASSES}>
            <SignInFace onRequestSignUp={() => setMode("signup")} />
          </div>
          <div className={`${FACE_CLASSES} [transform:rotateY(180deg)]`}>
            <SignUpFace onBack={() => setMode("signin")} />
          </div>
        </div>
      </div>
    </div>
  );
}
