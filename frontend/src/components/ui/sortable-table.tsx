import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';

import './table.css';

export type SortDirection = 'asc' | 'desc';

export function SortableTableHead({
  children,
  column,
  direction,
  onSort,
  sortColumn,
}: {
  children: ReactNode;
  column: string;
  direction: SortDirection;
  onSort: (column: string) => void;
  sortColumn: string | null;
}) {
  const active = sortColumn === column;
  return (
    <button
      aria-label={`Sort by ${typeof children === 'string' ? children : column}${active ? `, ${direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
      aria-pressed={active}
      className="ui-table-sort"
      onClick={() => onSort(column)}
      type="button"
    >
      <span>{children}</span>
      {active ? direction === 'asc' ? <ArrowUp aria-hidden="true" size={13} /> : <ArrowDown aria-hidden="true" size={13} /> : <ArrowUpDown aria-hidden="true" size={13} />}
    </button>
  );
}

export function useSortedRows<T>(
  rows: readonly T[],
  getValue: (row: T, column: string) => string | number | boolean | null | undefined,
) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [direction, setDirection] = useState<SortDirection>('asc');

  const sortedRows = sortColumn
    ? rows
      .map((row, index) => ({ row, index, value: getValue(row, sortColumn) }))
      .sort((left, right) => compareSortValues(left.value, right.value) * (direction === 'asc' ? 1 : -1) || left.index - right.index)
      .map(({ row }) => row)
    : [...rows];

  const onSort = (column: string) => {
    if (column === sortColumn) setDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortColumn(column);
      setDirection('asc');
    }
  };

  return { direction, onSort, sortColumn, sortedRows };
}

function compareSortValues(left: string | number | boolean | null | undefined, right: string | number | boolean | null | undefined) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  if (typeof left === 'boolean' && typeof right === 'boolean') return Number(left) - Number(right);
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
}
