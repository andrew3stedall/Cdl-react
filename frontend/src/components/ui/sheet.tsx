import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

interface SheetProps {
  children: ReactNode;
  id: string;
  isOpen: boolean;
  labelledBy: string;
  onClose?: () => void;
}

export function Sheet({ children, id, isOpen, labelledBy, onClose }: SheetProps) {
  const dialogRef = useRef<HTMLElement>(null);
  useModalLifecycle(dialogRef, isOpen, onClose);

  return (
    <aside
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="ui-sheet"
      hidden={!isOpen}
      id={id}
      ref={dialogRef}
      role="dialog"
      tabIndex={-1}
    >
      {children}
    </aside>
  );
}

export function useModalLifecycle(
  dialogRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose?: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!isOpen || !dialog) return undefined;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true');
    const first = focusable()[0] ?? dialog;
    first.focus();

    const inerted: Array<[HTMLElement, boolean]> = [];
    let node: HTMLElement | null = dialog;
    while (node && node !== document.body) {
      const parentElement: HTMLElement | null = node.parentElement;
      if (!parentElement || parentElement === document.body) break;
      Array.from(parentElement.children).forEach((sibling) => {
        if (sibling !== node && sibling instanceof HTMLElement) {
          inerted.push([sibling, sibling.inert]);
          sibling.inert = true;
        }
      });
      node = parentElement;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === dialog)) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      inerted.forEach(([element, wasInert]) => { element.inert = wasInert; });
      opener?.focus();
    };
  }, [isOpen]);
}
