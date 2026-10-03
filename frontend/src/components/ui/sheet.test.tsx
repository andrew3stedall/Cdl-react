import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { Sheet } from './sheet';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('Sheet modal lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
  });

  test('moves focus in, traps Tab, closes on Escape, and restores focus', () => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    const onClose = vi.fn();

    act(() => {
      root.render(
        <>
          <button onClick={() => undefined} type="button">Open</button>
          <Sheet id="test-sheet" isOpen={false} labelledBy="sheet-title" onClose={onClose}>
            <h2 id="sheet-title">Test sheet</h2>
            <button type="button">First</button>
            <button type="button">Last</button>
          </Sheet>
        </>,
      );
    });

    const opener = container.querySelector('button') as HTMLButtonElement;
    opener.focus();
    act(() => root.render(
      <>
        <button onClick={() => undefined} type="button">Open</button>
        <Sheet id="test-sheet" isOpen labelledBy="sheet-title" onClose={onClose}>
          <h2 id="sheet-title">Test sheet</h2>
          <button type="button">First</button>
          <button type="button">Last</button>
        </Sheet>
      </>,
    ));

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const [first, last] = Array.from(dialog.querySelectorAll('button'));
    expect(document.activeElement).toBe(first);

    last.focus();
    act(() => last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(first);

    act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onClose).toHaveBeenCalledOnce();

    act(() => root.render(
      <>
        <button onClick={() => undefined} type="button">Open</button>
        <Sheet id="test-sheet" isOpen={false} labelledBy="sheet-title" onClose={onClose}>
          <h2 id="sheet-title">Test sheet</h2>
        </Sheet>
      </>,
    ));
    expect(document.activeElement).toBe(opener);
  });
});
