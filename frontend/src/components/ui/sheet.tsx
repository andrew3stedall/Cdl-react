import type { ReactNode } from 'react';

interface SheetProps {
  children: ReactNode;
  id: string;
  isOpen: boolean;
  labelledBy: string;
}

export function Sheet({ children, id, isOpen, labelledBy }: SheetProps) {
  return (
    <aside
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="ui-sheet"
      hidden={!isOpen}
      id={id}
      role="dialog"
    >
      {children}
    </aside>
  );
}
