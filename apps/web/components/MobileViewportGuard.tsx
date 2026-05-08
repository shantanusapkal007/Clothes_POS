"use client";

import { useEffect } from "react";

export function MobileViewportGuard() {
  useEffect(() => {
    const preventGesture = (event: Event) => event.preventDefault();
    const preventCtrlZoom = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
      }
    };

    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });
    window.addEventListener("wheel", preventCtrlZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      window.removeEventListener("wheel", preventCtrlZoom);
    };
  }, []);

  return null;
}
