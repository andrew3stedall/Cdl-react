import { useEffect, useRef, useState } from 'react';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(options: {
    button_auto_select: boolean;
    client_id: string;
    callback(response: GoogleCredentialResponse): void;
    use_fedcm_for_button: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      logo_alignment: 'left';
      shape: 'rectangular';
      size: 'large';
      text: 'signin_with';
      theme: 'filled_black';
      width: number;
    },
  ): void;
  prompt(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const SCRIPT_ID = 'google-identity-services';
const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

interface GoogleSignInButtonProps {
  clientId: string;
  onCredential(credential: string): void | Promise<void>;
}

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');

    const handleLoad = () => resolve();
    const handleError = () => reject(new Error('Google Identity Services could not be loaded.'));
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existing) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

export function GoogleSignInButton({ clientId, onCredential }: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    setReady(false);

    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return;
        window.google.accounts.id.initialize({
          // FedCM lets returning users confirm the account already shown by Google's
          // personalized button without opening the account chooser first.
          button_auto_select: true,
          client_id: clientId,
          callback: (response) => void onCredential(response.credential),
          use_fedcm_for_button: true,
        });
        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          logo_alignment: 'left',
          shape: 'rectangular',
          size: 'large',
          text: 'signin_with',
          theme: 'filled_black',
          width: Math.min(400, buttonRef.current.clientWidth || 320),
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setReady(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, onCredential]);

  if (loadError) {
    return <p className="login-error">Google sign-in could not load. Use Chrome or try again.</p>;
  }

  return (
    <div className="google-sign-in-shell">
      <div className="google-sign-in" ref={buttonRef} />
      {ready ? (
        <button
          className="google-account-switch"
          onClick={() => window.google?.accounts.id.prompt()}
          type="button"
        >
          Use another Google account
        </button>
      ) : null}
    </div>
  );
}
