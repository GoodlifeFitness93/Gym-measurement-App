import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { pushBackHandler, removeBackHandler } from '../../lib/backStack';

type ModalSize = 'sm' | 'md' | 'lg';

interface Props {
  title?: string;
  /** Rendered left of the title (e.g. a Lucide icon). */
  icon?: React.ReactNode;
  onClose: () => void;
  size?: ModalSize;
  /** Sticky action row pinned to the bottom of the sheet, always reachable. */
  footer?: React.ReactNode;
  /** Set false for destructive confirmations that must be answered. */
  dismissOnBackdrop?: boolean;
  children: React.ReactNode;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
};

/**
 * The single modal/sheet standard for the whole app.
 *
 * Mobile  → bottom sheet, capped at 88dvh so the URL bar can never clip it.
 * Desktop → centred card.
 *
 * Guarantees: it always sits above the header and bottom navigation (z-[60] vs
 * z-20), the header/close button stays pinned, the body scrolls on its own, and
 * the footer actions stay reachable above the home indicator.
 */
export const Modal: React.FC<Props> = ({
  title,
  icon,
  onClose,
  size = 'md',
  footer,
  dismissOnBackdrop = true,
  children,
}) => {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Android/browser Back closes the sheet instead of leaving the screen.
  useEffect(() => {
    const id = pushBackHandler(() => {
      closeRef.current();
    });
    return () => removeBackHandler(id);
  }, []);

  // Escape to close + lock the page behind the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        className={`bg-surface border border-border rounded-t-2xl sm:rounded-2xl w-full ${SIZE_CLASS[size]} flex flex-col overflow-hidden`}
        style={{ maxHeight: 'var(--sheet-max-h)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="shrink-0 bg-surface border-b border-border px-5 py-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2.5 min-w-0">
              {icon}
              <span className="truncate">{title}</span>
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 p-2 rounded-full bg-surface-alt hover:bg-border text-text-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain no-scrollbar">
          {children}
          {!footer && <div className="pb-safe" />}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border bg-surface px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
