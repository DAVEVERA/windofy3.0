"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

function clampPosition(value: number) {
  return Math.max(8, Math.min(92, value));
}

export function HeroWoodBlind3D() {
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(50);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = (clientX: number) => {
    const widget = widgetRef.current;
    if (!widget) {
      return;
    }
    const rect = widget.getBoundingClientRect();
    const nextPosition = ((clientX - rect.left) / rect.width) * 100;
    setPosition(clampPosition(nextPosition));
  };

  useEffect(() => {
    if (!dragging) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => updateFromClientX(event.clientX);
    const onPointerUp = () => setDragging(false);

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [dragging]);

  const clipStyle = { clipPath: `inset(0 0 0 ${position}%)` };
  const controlStyle = { left: `${position}%` };

  return (
    <div className="hero-demo-shell" aria-label="Voor en na visualisatie van raamdecoratie">
      <div
        ref={widgetRef}
        className="hero-demo-widget"
        onPointerDown={(event) => {
          setDragging(true);
          updateFromClientX(event.clientX);
        }}
      >
        <Image
          className="hero-demo-layer"
          src="/Hero/demo-before.png"
          alt="Leeg houten raam in een veld bij zonsondergang"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
        />
        <Image
          className="hero-demo-layer hero-demo-after"
          src="/Hero/demo-after.png"
          alt="Hetzelfde raam met fotorealistische houten lamellen ingerenderd"
          fill
          priority
          sizes="(max-width: 900px) 100vw, 58vw"
          style={clipStyle}
        />
        <span className="hero-demo-label hero-demo-label-before">Voor</span>
        <span className="hero-demo-label hero-demo-label-after">Na</span>
        <span className="hero-demo-divider" style={controlStyle} />
        <button
          className="hero-demo-handle"
          type="button"
          aria-label="Voor en na slider"
          aria-valuemin={8}
          aria-valuemax={92}
          aria-valuenow={Math.round(position)}
          role="slider"
          style={controlStyle}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              setPosition((current) => clampPosition(current - 4));
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              setPosition((current) => clampPosition(current + 4));
            }
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 4L3 10L7 16M13 4L17 10L13 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      <div className="hero-demo-caption">
        <span>AI visualisatie</span>
        <strong>Van foto naar fotorealistisch verkoopbeeld.</strong>
      </div>
    </div>
  );
}
