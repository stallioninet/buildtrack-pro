import { useEffect, useRef } from 'react';

export default function FocusTrap({ children, active = true }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    if (!el) return;

    const focusable = el.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // Focus first element
    first.focus();

    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return <div ref={ref}>{children}</div>;
}
