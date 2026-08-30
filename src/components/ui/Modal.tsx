import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Rendered instead of the default title bar — used by media-led detail modals. */
  header?: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  flushBody?: boolean;
  children: ReactNode;
  labelledBy?: string;
  /**
   * Accessible name for dialogs whose header is an image rather than a title.
   * role="dialog" does not take its name from content, so without one of
   * `title`, `labelledBy` or this, the dialog is announced as just "dialog".
   */
  label?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  header,
  footer,
  wide,
  flushBody,
  children,
  labelledBy,
  label,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Every caller passes a fresh inline arrow for onClose, so depending on it
  // would re-run this effect on each parent render — tearing focus back out of
  // whatever the user had tabbed to. Latch it instead and depend only on open.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;

    previouslyFocused.current = document.activeElement as HTMLElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    // Move focus into the dialog so screen readers land in the right place.
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      // Trap focus inside the dialog.
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null,
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        aria-label={!labelledBy && !title ? label : undefined}
        ref={panelRef}
        tabIndex={-1}
      >
        {header ?? (
          <div className="modal__head">
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            <button className="modal__close" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>
        )}

        <div className={`modal__body${flushBody ? ' modal__body--flush' : ''}`}>{children}</div>

        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** Floating close button for modals whose header is an image. */
export function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      className="modal__close"
      onClick={onClose}
      aria-label="Close"
      style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, background: 'rgba(8,8,18,0.7)' }}
    >
      <X size={18} />
    </button>
  );
}
