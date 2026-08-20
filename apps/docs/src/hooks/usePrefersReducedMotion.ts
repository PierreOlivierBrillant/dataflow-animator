import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Whether the visitor asked their system to reduce motion.
 *
 * SSR-safe by construction: the initial value is `false` — the same value the
 * server renders — and the real preference is read in an effect. Seeding from
 * `matchMedia` directly would make the first client render disagree with the
 * markup and tear the hydration.
 *
 * The site uses it for one thing above all: NOT auto-playing an animation. A
 * player is a legitimate use of motion, but a player that starts on its own,
 * loops forever and carries no control bar is motion the visitor cannot stop —
 * which is what WCAG 2.2.2 forbids. Under this preference the same players are
 * mounted, rendered at their first frame, and wait to be asked.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
