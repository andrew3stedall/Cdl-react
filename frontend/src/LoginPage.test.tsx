import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, test, vi } from 'vitest';

import { LoginPage } from './LoginPage';

const testGlobal = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean };
testGlobal.IS_REACT_ACT_ENVIRONMENT = true;

function renderLoginPage(overrides: Partial<Parameters<typeof LoginPage>[0]> = {}) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const props: Parameters<typeof LoginPage>[0] = {
    email: '',
    error: null,
    googleClientId: null,
    password: '',
    pending: false,
    showRetry: false,
    onEmailChange: vi.fn(),
    onGoogleCredential: vi.fn(),
    onPasswordChange: vi.fn(),
    onRetry: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };

  act(() => {
    root.render(<LoginPage {...props} />);
  });

  return { container, props, root };
}

describe('LoginPage', () => {
  test('renders Castle Draft League branding and real authentication fields', () => {
    const { container } = renderLoginPage();

    expect(container.textContent).toContain('Castle Draft League');
    expect(container.textContent).toContain('Welcome back');
    expect(container.textContent).toContain('Build your squad. Shape your legacy.');
    expect(container.querySelector('input[name="email"]')).not.toBeNull();
    expect(container.querySelector('input[name="password"]')).not.toBeNull();
    expect(container.textContent).not.toContain('Create an account');
    expect(container.textContent).not.toContain('Forgot password');
  });

  test('toggles password visibility without changing authentication state', () => {
    const { container } = renderLoginPage({ password: 'castle-secret' });
    const password = container.querySelector('input[name="password"]') as HTMLInputElement;
    const toggle = container.querySelector('.login-password-toggle') as HTMLButtonElement;

    expect(password.type).toBe('password');
    act(() => toggle.click());
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
  });

  test('shows retry and server error feedback only when supplied', () => {
    const onRetry = vi.fn();
    const { container } = renderLoginPage({
      error: 'Invalid email or password.',
      onRetry,
      showRetry: true,
    });

    expect(container.querySelector('[role="status"]')?.textContent).toContain('Invalid email or password.');
    const retry = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.includes('Retry session check')
    ));
    expect(retry).toBeDefined();
    act(() => retry?.click());
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
