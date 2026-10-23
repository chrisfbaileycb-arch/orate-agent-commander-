import { useEffect, useRef } from "react";
import { createPlasma } from "../canvas/plasma";

/** Full-viewport ambient plasma canvas rendered behind the app. */
export default function PlasmaBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const handle = createPlasma(ref.current);
    return () => handle.destroy();
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="fixed inset-0 -z-10 h-full w-full"
    />
  );
}
