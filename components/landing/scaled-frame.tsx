"use client";

import { useEffect, useRef, useState } from "react";

/** Renders children at a fixed design width and scales them to fit the container. */
export function ScaledFrame({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.8);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);
  return (
    <div ref={ref} className="relative w-full overflow-hidden" style={{ height: height * scale }}>
      <div className="pointer-events-none origin-top-left" style={{ width, height, transform: `scale(${scale})` }} aria-hidden inert>
        {children}
      </div>
    </div>
  );
}
