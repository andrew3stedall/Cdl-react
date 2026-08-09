import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { GoogleSignInButton } from './GoogleSignInButton';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function renderButton() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const onCredential = vi.fn();
  const googleId = {
    initialize: vi.fn(),
    prompt: vi.fn(),
    renderButton: vi.fn(),
  };

  vi.stubGlobal('google', { accounts: { id: googleId } });

  act(() => {
    root.render(
      <GoogleSignInButton
        clientId="staging-client.apps.googleusercontent.com"
        onCredential={onCredential}
      />,
    );
  });

  return { container, googleId, onCredential, root };
}

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('GoogleSignInButton', () => {
  test('uses the official dark button with returning-account auto-select', async () => {
    const { googleId } = renderButton();

    await act(async () => {
      await Promise.resolve();
    });

    expect(googleId.initialize).toHaveBeenCalledWith(expect.objectContaining({
      button_auto_select: true,
      client_id: 'staging-client.apps.googleusercontent.com',
      use_fedcm_for_button: true,
    }));
    expect(googleId.renderButton).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        logo_alignment: 'left',
        theme: 'filled_black',
      }),
    );
  });

  test('keeps an explicit account-switch path beside the primary Google action', async () => {
    const { container, googleId } = renderButton();

    await act(async () => {
      await Promise.resolve();
    });

    const switchAccount = container.querySelector('.google-account-switch') as HTMLButtonElement;
    expect(switchAccount).not.toBeNull();

    act(() => switchAccount.click());

    expect(googleId.prompt).toHaveBeenCalledOnce();
  });
});
