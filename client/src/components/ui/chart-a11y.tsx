import { useLayoutEffect, useRef, type ReactNode } from 'react';

/**
 * Recharts renders every pie sector as `<path role="img">` with no accessible
 * name, which fails axe's svg-img-alt rule. The data is already conveyed by
 * the legend/list rendered below the chart, so this wrapper:
 *
 *  - labels the chart itself (role="img" + aria-label on the container), and
 *  - marks the sector paths decorative (role stripped, aria-hidden) so axe
 *    stops treating each slice as an unnamed image.
 *
 * ResponsiveContainer renders asynchronously (it measures the parent first),
 * so a MutationObserver strips the role whenever recharts adds/re-adds it —
 * a plain layout effect misses sectors that mount after the first pass.
 */
export function DecorativeChart({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const strip = () => {
      el.querySelectorAll('path.recharts-sector').forEach((p) => {
        p.removeAttribute('role');
        p.setAttribute('aria-hidden', 'true');
      });
    };
    strip();
    const mo = new MutationObserver(strip);
    mo.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['role'] });
    return () => mo.disconnect();
  }, []);

  return (
    <div ref={ref} role="img" aria-label={label} className="w-full">
      {children}
    </div>
  );
}
