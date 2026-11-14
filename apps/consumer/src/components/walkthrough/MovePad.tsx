import { useEffect, useRef, useState } from "react";

// The walkthrough's movement pad (approved 2026-11-14, lighter and lower):
// always visible at the bottom left, a thin white ring with four arrows and a
// soft knob over the room; the arrow you're heading toward lights up gold.
//
// Phones: the engine's own touch joystick still does the moving (a touch on
// the left half of the screen); this pad shows it, the knob following the
// thumb's offset from where it went down. It ignores touches itself so they
// reach the engine.
// Computers: the pad can be dragged with the mouse. It presses W/A/S/D for
// you (the engine reads keys from the whole page), and lights up when you use
// the keys or arrow keys directly.

type Dir = "up" | "right" | "down" | "left";

const RADIUS = 30;
const DEAD = 10;
const KEYS: Record<Dir, string> = { up: "KeyW", right: "KeyD", down: "KeyS", left: "KeyA" };
const FROM_KEY: Record<string, Dir> = { KeyW: "up", ArrowUp: "up", KeyD: "right", ArrowRight: "right", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left" };

function clamp(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  return len > RADIUS ? [(dx / len) * RADIUS, (dy / len) * RADIUS] : [dx, dy];
}

function dirsOf(dx: number, dy: number): Set<Dir> {
  const out = new Set<Dir>();
  if (dy < -DEAD) out.add("up");
  if (dy > DEAD) out.add("down");
  if (dx < -DEAD) out.add("left");
  if (dx > DEAD) out.add("right");
  return out;
}

const press = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, bubbles: true }));

export function MovePad({ touchStick }: { touchStick: [number, number, number, number] | null }) {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const [keysLit, setKeysLit] = useState<Set<Dir>>(new Set());
  const held = useRef<Set<Dir>>(new Set());
  const padRef = useRef<HTMLDivElement>(null);

  // Light the arrows when moving with the keyboard.
  useEffect(() => {
    if (coarse) return;
    const on = (e: KeyboardEvent, down: boolean) => {
      const d = FROM_KEY[e.code];
      if (!d) return;
      setKeysLit((prev) => {
        const next = new Set(prev);
        if (down) next.add(d); else next.delete(d);
        return next;
      });
    };
    const kd = (e: KeyboardEvent) => on(e, true);
    const ku = (e: KeyboardEvent) => on(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [coarse]);

  // Mouse dragging: hold the matching keys while the pad is pushed that way.
  const sync = (dirs: Set<Dir>) => {
    for (const d of held.current) if (!dirs.has(d)) press(KEYS[d], false);
    for (const d of dirs) if (!held.current.has(d)) press(KEYS[d], true);
    held.current = dirs;
  };
  const fromPointer = (e: React.PointerEvent) => {
    const rect = padRef.current!.getBoundingClientRect();
    const [dx, dy] = clamp(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
    setDrag([dx, dy]);
    sync(dirsOf(dx, dy));
  };
  const release = () => { setDrag(null); sync(new Set()); };
  useEffect(() => () => sync(new Set()), []); // never leave a key held

  const knob: [number, number] = coarse
    ? touchStick ? clamp(touchStick[2] - touchStick[0], touchStick[3] - touchStick[1]) : [0, 0]
    : drag ?? [0, 0];
  const lit = coarse || drag ? dirsOf(knob[0], knob[1]) : keysLit;

  return (
    <div className="walkthrough-move-pad pointer-events-none absolute left-5 z-10 md:left-[calc(var(--panel-w,0px)+2.5rem)]">
      <div
        ref={padRef}
        role={coarse ? "img" : "slider"}
        aria-label={coarse ? "Move: touch and drag on the left side of the screen" : "Move: drag the pad, or use W A S D or the arrow keys"}
        className={`relative size-26 touch-none rounded-full ${coarse ? "" : "pointer-events-auto cursor-grab active:cursor-grabbing"}`}
        onPointerDown={coarse ? undefined : (e) => { e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={coarse ? undefined : (e) => { if (drag) fromPointer(e); }}
        onPointerUp={coarse ? undefined : release}
        onPointerCancel={coarse ? undefined : release}
      >
        <span className="absolute inset-0 rounded-full border-[1.5px] border-white/45 bg-white/14 backdrop-blur-[6px]" aria-hidden="true" />
        {(["up", "right", "down", "left"] as Dir[]).map((d, i) => (
          <svg
            key={d}
            viewBox="0 0 24 24"
            className="absolute top-1/2 left-1/2 size-4 drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)] transition-colors"
            style={{ transform: `translate(-50%, -50%) rotate(${i * 90}deg) translateY(-36px)` }}
            aria-hidden="true"
          >
            <path d="m7 14 5-5 5 5" fill="none" stroke={lit.has(d) ? "var(--brand-gold)" : "rgba(255,255,255,0.9)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ))}
        <span
          className="absolute top-1/2 left-1/2 size-9.5 rounded-full bg-white/82 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.45)]"
          style={{ transform: `translate(calc(-50% + ${knob[0]}px), calc(-50% + ${knob[1]}px))` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
