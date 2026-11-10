import { useEffect, useRef } from "react";
import { registerBackOverlay } from "../back-navigation.js";

export function useBackOverlay(active, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!active) return undefined;
    return registerBackOverlay(() => closeRef.current?.());
  }, [active]);
}
