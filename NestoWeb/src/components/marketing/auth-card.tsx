"use client";

import { useEffect, useRef, useState } from "react";
import { SignInFace } from "@/components/marketing/sign-in-face";
import { SignUpFace } from "@/components/marketing/sign-up-face";
import { RegistrationFace } from "@/components/marketing/registration-face";
import type { PublicAccountType } from "@/lib/constants";

const MAX_TILT_DEG = 6;
const MAX_GLOW_SHIFT_PX = 26;
const HALF_FLIP_MS = 260; // half of --motion-flip's 520ms
const FLIP_EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // matches --motion-flip-ease

type Theme = "signin" | "signup" | "professional" | "contractor";
const THEMES: Theme[] = ["signin", "signup", "professional", "contractor"];

// Drives one rotating "shell" that only ever has ONE piece of content
// mounted at a time, swapped at the 90deg midpoint (edge-on, so the swap is
// invisible) rather than the usual two-sided card with backface-visibility.
//
// The two-sided approach was tried first and reliably breaks under
// compound/nested rotation: backface-visibility only decides whether an
// element's OWN box renders when facing away — it does not cascade to
// descendants, and a nested "hidden" face's independently-accumulated angle
// can pass back through the visible range mid-transition even while its
// ancestor is still rotating away from it. Combined with the glass card's
// translucency, that showed up as a real double-exposure (the previous
// face briefly visible through the new one). Swapping content at the
// invisible midpoint has no such failure mode — there is only ever one
// face in the DOM per shell, so there is nothing left to bleed through.
function useContentFlip<T>(initial: T, elRef: React.RefObject<HTMLDivElement | null>) {
  const [rendered, setRendered] = useState<T>(initial);
  const pendingRef = useRef(false);

  function flipTo(next: T) {
    if (pendingRef.current || next === rendered) return;
    const el = elRef.current;
    if (!el) {
      setRendered(next);
      return;
    }
    pendingRef.current = true;
    el.style.transition = `transform ${HALF_FLIP_MS}ms ${FLIP_EASE}`;
    el.style.transform = "rotateY(90deg)";
    const onLeaveEnd = () => {
      el.removeEventListener("transitionend", onLeaveEnd);
      setRendered(next);
      // Instant (untransitioned) snap to the mirrored entry angle, then
      // animate the second half back to rest — two chained transitions
      // rather than one 0->180 sweep, so the content swap always lands
      // exactly at the edge-on moment regardless of easing shape.
      el.style.transition = "none";
      el.style.transform = "rotateY(-90deg)";
      void el.offsetWidth; // force reflow so the instant snap actually applies before re-enabling the transition
      requestAnimationFrame(() => {
        el.style.transition = `transform ${HALF_FLIP_MS}ms ${FLIP_EASE}`;
        el.style.transform = "rotateY(0deg)";
        const onEnterEnd = () => {
          el.removeEventListener("transitionend", onEnterEnd);
          pendingRef.current = false;
        };
        el.addEventListener("transitionend", onEnterEnd, { once: true });
      });
    };
    el.addEventListener("transitionend", onLeaveEnd, { once: true });
  }

  return { rendered, flipTo };
}

// Landing-page auth card. Everyone — signing in, or applying as a
// Professional/Contractor — stays inside this one fixed-size (350x480)
// element for the whole flow; nothing here is a page navigation.
//
// Two independent shells: outer (signin <-> "signup area"), and inner
// (choose-type <-> registration form, whose content depends on
// applicantType), nested exactly like the flow itself — the inner shell
// only exists while the outer shell is showing "signup area". Going back
// always collapses whichever shell was used to go forward, never the other.
//
// A separate tilt layer wraps both shells so the mouse-driven parallax
// (fast, ~150ms) never fights the deliberate flip transition — both are
// rotateY under the hood but live on different elements with different
// transition speeds, composing naturally since nested preserve-3d contexts
// stack.
export function AuthCard() {
  const [applicantType, setApplicantType] = useState<PublicAccountType>("PROFESSIONAL");
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const outer = useContentFlip<"signin" | "signupArea">("signin", outerRef);
  const inner = useContentFlip<"choose" | "form">("choose", innerRef);

  const tiltRef = useRef<HTMLDivElement>(null);
  const glowRefs = useRef<Record<Theme, HTMLDivElement | null>>({
    signin: null,
    signup: null,
    professional: null,
    contractor: null,
  });
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
        for (const theme of THEMES) {
          const el = glowRefs.current[theme];
          if (el) el.style.transform = glowTransform;
        }
      });
    }
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const activeTheme: Theme =
    outer.rendered === "signin" ? "signin" : inner.rendered === "choose" ? "signup" : applicantType === "PROFESSIONAL" ? "professional" : "contractor";

  return (
    <div className="relative w-[350px] max-w-full h-[480px] [perspective:1400px]">
      {THEMES.map((theme) => (
        <div
          key={theme}
          ref={(el) => {
            glowRefs.current[theme] = el;
          }}
          className={`auth-ambient auth-ambient-${theme} ${activeTheme === theme ? "opacity-100" : "opacity-0"}`}
        />
      ))}

      <div
        ref={tiltRef}
        className="relative h-full w-full [transform-style:preserve-3d] transition-transform duration-150 ease-out"
      >
        <div
          ref={outerRef}
          className="absolute inset-0 overflow-hidden rounded-2xl auth-glass [transform-style:preserve-3d] [will-change:transform]"
        >
          {outer.rendered === "signin" ? (
            <SignInFace onRequestSignUp={() => outer.flipTo("signupArea")} />
          ) : (
            <div ref={innerRef} className="h-full w-full [transform-style:preserve-3d] [will-change:transform]">
              {inner.rendered === "choose" ? (
                <SignUpFace
                  onSelectType={(type) => {
                    setApplicantType(type);
                    inner.flipTo("form");
                  }}
                  onBack={() => outer.flipTo("signin")}
                />
              ) : (
                <RegistrationFace applicantType={applicantType} onBack={() => inner.flipTo("choose")} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
