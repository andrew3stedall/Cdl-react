import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';

function joinClasses(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={joinClasses('ui-table', className)} {...props} />;
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={joinClasses('ui-table__header', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={joinClasses('ui-table__body', className)} {...props} />;
}

export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tfoot className={joinClasses('ui-table__footer', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={joinClasses('ui-table__row', className)} {...props} />;
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={joinClasses('ui-table__head', className)} scope={props.scope ?? 'col'} {...props} />;
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={joinClasses('ui-table__cell', className)} {...props} />;
}

export function TableCaption({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) {
  return <caption className={joinClasses('ui-table__caption', className)} {...props} />;
}
