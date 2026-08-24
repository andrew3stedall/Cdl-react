import type { AuthResult, LoginResponse } from './auth';
import type { ApiErrorResponse } from './contracts';

type JsonCredential = Record<string, unknown>;

export interface PasskeyStatus {
  enabled: boolean;
  registeredCount: number;
}

export async function getPasskeyStatus(): Promise<PasskeyStatus> {
  const response = await fetch('/api/auth/passkeys/status', { credentials: 'include' });
  if (!response.ok) return { enabled: false, registeredCount: 0 };
  const payload = (await response.json()) as { enabled?: boolean; registered_count?: number };
  return {
    enabled: payload.enabled === true,
    registeredCount: payload.registered_count ?? 0,
  };
}

export async function registerPasskey(): Promise<AuthResult<{ registered: boolean }>> {
  if (!supportsPasskeys()) {
    return { ok: false, error: unsupportedError() };
  }

  try {
    const optionsResponse = await fetch('/api/auth/passkeys/registration/options', {
      credentials: 'include',
    });
    if (!optionsResponse.ok) return { ok: false, error: await readError(optionsResponse, 'Passkey setup is unavailable.') };
    const options = decodeCreationOptions(await optionsResponse.json());
    const credential = await navigator.credentials.create({ publicKey: options });
    if (!(credential instanceof PublicKeyCredential)) {
      return { ok: false, error: unsupportedError() };
    }
    const response = await fetch('/api/auth/passkeys/registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential: serializeCredential(credential) }),
    });
    if (!response.ok) return { ok: false, error: await readError(response, 'Passkey setup failed.') };
    return { ok: true, data: { registered: true } };
  } catch (error) {
    return { ok: false, error: ceremonyError(error, 'Passkey setup was cancelled or unavailable.') };
  }
}

export async function loginWithPasskey(): Promise<AuthResult<LoginResponse>> {
  if (!supportsPasskeys()) {
    return { ok: false, error: unsupportedError() };
  }

  try {
    const optionsResponse = await fetch('/api/auth/passkeys/authentication/options', {
      credentials: 'include',
    });
    if (!optionsResponse.ok) return { ok: false, error: await readError(optionsResponse, 'Passkey sign-in is unavailable.') };
    const options = decodeRequestOptions(await optionsResponse.json());
    const credential = await navigator.credentials.get({ publicKey: options });
    if (!(credential instanceof PublicKeyCredential)) {
      return { ok: false, error: unsupportedError() };
    }
    const response = await fetch('/api/auth/passkeys/authentication', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential: serializeCredential(credential) }),
    });
    if (!response.ok) {
      return { ok: false, error: await readError(response, 'Passkey sign-in could not be verified.') };
    }
    const payload = (await response.json()) as {
      session: {
        is_authenticated: boolean;
        user: { id: string; email: string; display_name: string; roles: string[] } | null;
        expires_at: string | null;
      };
    };
    return {
      ok: true,
      data: {
        session: {
          isAuthenticated: payload.session.is_authenticated,
          user: payload.session.user
            ? {
                id: payload.session.user.id,
                email: payload.session.user.email,
                displayName: payload.session.user.display_name,
                roles: payload.session.user.roles,
              }
            : null,
          expiresAt: payload.session.expires_at,
        },
      },
    };
  } catch (error) {
    return { ok: false, error: ceremonyError(error, 'Passkey sign-in was cancelled or unavailable.') };
  }
}

function supportsPasskeys(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && typeof navigator.credentials?.create === 'function'
    && typeof navigator.credentials?.get === 'function'
    && typeof PublicKeyCredential !== 'undefined';
}

function decodeCreationOptions(options: Record<string, unknown>): PublicKeyCredentialCreationOptions {
  const user = isRecord(options.user) ? options.user : {};
  const excludeCredentials = Array.isArray(options.excludeCredentials)
    ? options.excludeCredentials.filter(isRecord)
    : [];
  return {
    ...options,
    challenge: decodeBase64Url(String(options.challenge)),
    user: { ...user, id: decodeBase64Url(String(user.id)) },
    excludeCredentials: excludeCredentials.map((descriptor) => ({
      ...descriptor,
      id: decodeBase64Url(String(descriptor.id)),
    })),
  } as unknown as PublicKeyCredentialCreationOptions;
}

function decodeRequestOptions(options: Record<string, unknown>): PublicKeyCredentialRequestOptions {
  const allowCredentials = Array.isArray(options.allowCredentials)
    ? options.allowCredentials.filter(isRecord)
    : undefined;
  return {
    ...options,
    challenge: decodeBase64Url(String(options.challenge)),
    allowCredentials: allowCredentials?.map((descriptor) => ({
      ...descriptor,
      id: decodeBase64Url(String(descriptor.id)),
    })),
  } as unknown as PublicKeyCredentialRequestOptions;
}

function serializeCredential(credential: PublicKeyCredential): JsonCredential {
  const response = credential.response;
  const payload: Record<string, unknown> = {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment,
    response: {
      clientDataJSON: encodeBase64Url(response.clientDataJSON),
    },
  };
  const responsePayload = payload.response as Record<string, unknown>;
  if ('attestationObject' in response) {
    const attestation = response as AuthenticatorAttestationResponse;
    responsePayload.attestationObject = encodeBase64Url(attestation.attestationObject);
    const getTransports = (attestation as AuthenticatorAttestationResponse & {
      getTransports?: () => string[];
    }).getTransports;
    responsePayload.transports = getTransports ? getTransports.call(attestation) : [];
  } else {
    const assertion = response as AuthenticatorAssertionResponse;
    responsePayload.authenticatorData = encodeBase64Url(assertion.authenticatorData);
    responsePayload.signature = encodeBase64Url(assertion.signature);
    responsePayload.userHandle = assertion.userHandle ? encodeBase64Url(assertion.userHandle) : null;
  }
  return payload;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function encodeBase64Url(buffer: ArrayBufferLike): string {
  const binary = String.fromCharCode(...new Uint8Array(buffer));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function unsupportedError(): ApiErrorResponse {
  return {
    code: 'server_error',
    message: 'This device or browser does not support passkeys.',
    details: {},
  };
}

function ceremonyError(error: unknown, fallback: string): ApiErrorResponse {
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return { code: 'unauthenticated', message: 'Passkey sign-in was cancelled.', details: {} };
  }
  return { code: 'server_error', message: fallback, details: {} };
}

async function readError(response: Response, fallback: string): Promise<ApiErrorResponse> {
  try {
    const payload = (await response.json()) as Partial<ApiErrorResponse>;
    if (typeof payload.message === 'string') {
      return {
        code: payload.code ?? 'server_error',
        message: payload.message,
        details: payload.details ?? {},
      };
    }
  } catch {
    // Preserve a safe client-side fallback for infrastructure responses.
  }
  return { code: 'server_error', message: fallback, details: {} };
}
