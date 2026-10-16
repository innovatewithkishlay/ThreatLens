import { useEffect, useRef } from "react";

export const useClickOutside = <T extends HTMLElement>(handler: () => void, active = true) => {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) handlerRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && handlerRef.current();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [active]);

  return ref;
};
