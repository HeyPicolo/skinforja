import { useEffect, useRef, type ReactNode } from 'react';
import { Icon } from './Icon';

export function Dialog({ title, onClose, children, wide, footer, labelId }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode; labelId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = labelId ?? 'dlg-' + title.replace(/\W+/g, '-').toLowerCase();

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current!;
    const first = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>('button, input, select, [tabindex]');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab') {
        const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
        if (!items.length) return;
        const a = items[0], b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [onClose]);

  return (
    <div className="backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} className={'dialog' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-labelledby={id}>
        <header className="dialog-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </header>
        <div className="dialog-body">{children}</div>
        {footer && <footer className="dialog-foot">{footer}</footer>}
      </div>
    </div>
  );
}
