import { useEffect, useRef, useState } from "react";

/**
 * Adds the `in` class once an element scrolls into view (one-shot).
 * Pair with the `.reveal` rule in site.css for a fade-up entrance.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-60px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shown]);

  return { ref, className: shown ? "reveal in" : "reveal" };
}
