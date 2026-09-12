import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test } from 'vitest';

import { PageHero } from './page-hero';

const testGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT: boolean;
};
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

describe('PageHero', () => {
  test('exposes the shared header base used by every primary page', () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PageHero
          actions={<button type="button">Action</button>}
          actionsLabel="Page actions"
          title="Test page"
          titleId="test-page-title"
        />,
      );
    });

    expect(container.querySelector('[data-page-hero="shared"]')).not.toBeNull();
    expect(container.querySelector('.cdl-page-hero h1')?.id).toBe('test-page-title');
    expect(container.querySelector('.cdl-page-hero')?.className).toBe('cdl-page-hero');

    root.unmount();
    container.remove();
  });
});
