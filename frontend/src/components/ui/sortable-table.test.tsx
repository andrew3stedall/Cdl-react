import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { SortableTableHead, useSortedRows } from './sortable-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('sortable shadcn table', () => {
  test('sorts rows ascending and descending through the column header', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    const rows = [{ name: 'Baker', points: 5 }, { name: 'Archer', points: 12 }];

    function TestTable() {
      const { direction, onSort, sortColumn, sortedRows } = useSortedRows(rows, (row, column) => column === 'name' ? row.name : row.points);
      return <Table><TableHeader><TableRow><TableHead><SortableTableHead column="name" direction={direction} onSort={onSort} sortColumn={sortColumn}>Name</SortableTableHead></TableHead><TableHead><SortableTableHead column="points" direction={direction} onSort={onSort} sortColumn={sortColumn}>Points</SortableTableHead></TableHead></TableRow></TableHeader><TableBody>{sortedRows.map((row) => <TableRow key={row.name}><TableCell>{row.name}</TableCell><TableCell>{row.points}</TableCell></TableRow>)}</TableBody></Table>;
    }

    act(() => root.render(<TestTable />));
    expect([...container.querySelectorAll('tbody tr td:first-child')].map((cell) => cell.textContent)).toEqual(['Baker', 'Archer']);

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label^="Sort by Name"]')?.click());
    expect([...container.querySelectorAll('tbody tr td:first-child')].map((cell) => cell.textContent)).toEqual(['Archer', 'Baker']);

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label^="Sort by Name"]')?.click());
    expect([...container.querySelectorAll('tbody tr td:first-child')].map((cell) => cell.textContent)).toEqual(['Baker', 'Archer']);

    root.unmount();
    container.remove();
  });
});
