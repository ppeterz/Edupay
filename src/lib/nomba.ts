// ──────────────────────────────────────────────
// EduPay — Nomba Payment API
// ──────────────────────────────────────────────
// OAuth2 client with token caching, refresh, and virtual account provisioning.
// Tokens expire every 30 minutes — always use getValidToken() to auto-refresh.

import type {
  NombaAuthResponse,
  NombaVirtualAccountRequest,
  NombaVirtualAccountResponse,
} from '@/types';
import { NOMBA_AUTH_URL, NOMBA_API_URL, NOMBA_TOKEN_EXPIRY_MS } from './constants';

// ── Token Cache ──────────────────────────────

interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Date.now() + NOMBA_TOKEN_EXPIRY_MS
}

let tokenCache: TokenCache | null = null;

// ── Auth ─────────────────────────────────────

export async function getNombaToken(): Promise<NombaAuthResponse> {
  const res = await fetch(`${NOMBA_AUTH_URL}/auth/token/issue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accountId: process.env.NOMBA_ACCOUNT_ID ?? '',
    },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: process.env.NOMBA_CLIENT_ID,
      client_secret: process.env.NOMBA_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Nomba auth failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  return {
    access_token: data.data.access_token,
    refresh_token: data.data.refresh_token,
    expires_in: 1800,
    token_type: 'Bearer',
  };
}

export async function refreshNombaToken(
  refreshToken: string
): Promise<NombaAuthResponse> {
  const res = await fetch(`${NOMBA_AUTH_URL}/auth/token/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      accountId: process.env.NOMBA_ACCOUNT_ID ?? '',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.NOMBA_CLIENT_ID,
      client_secret: process.env.NOMBA_CLIENT_SECRET,
    }),
  });

  if (!res.ok) {
    throw new Error(`Nomba token refresh failed: ${res.status}`);
  }

  const data = await res.json();
  return {
    access_token: data.data.access_token,
    refresh_token: data.data.refresh_token,
    expires_in: 1800,
    token_type: 'Bearer',
  };
}

export async function getValidToken(): Promise<string> {
  // Return cached token if still valid
  if (tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }

  // Try refresh if we have a refresh token
  if (tokenCache?.refreshToken) {
    try {
      const data = await refreshNombaToken(tokenCache.refreshToken);
      tokenCache = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + NOMBA_TOKEN_EXPIRY_MS,
      };
      return tokenCache.accessToken;
    } catch (err) {
      // Refresh failed — fall through to full re-auth
      console.warn('Nomba token refresh failed, re-authenticating:', err);
      tokenCache = null;
    }
  }

  // Full re-authentication
  const data = await getNombaToken();
  tokenCache = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + NOMBA_TOKEN_EXPIRY_MS,
  };
  return tokenCache.accessToken;
}

export function clearTokenCache(): void {
  tokenCache = null;
}

// ── Virtual Accounts ─────────────────────────

export async function createVirtualAccount(
  payload: NombaVirtualAccountRequest
): Promise<{ accountNumber: string; bankName: string; accountRef: string }> {
  const subAccountId = process.env.NOMBA_SUB_ACCOUNT_ID;
  if (!subAccountId) {
    throw new Error('NOMBA_SUB_ACCOUNT_ID is not configured. Please contact the administrator to setup sub-account payments.');
  }

  const token = await getValidToken();

  // CRITICAL: never set expectedAmount — omit it entirely
  // so the account accepts payments of any amount
  const body: Record<string, string> = {
    accountName: payload.accountName,
    accountRef: payload.accountRef,
  };
  if (payload.bvn) body.bvn = payload.bvn;
  if (payload.nin) body.nin = payload.nin;

  const res = await fetch(`${NOMBA_API_URL}/accounts/virtual/${subAccountId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      accountId: process.env.NOMBA_ACCOUNT_ID ?? '',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Nomba virtual account creation failed: ${res.status} ${errorBody}`
    );
  }

  const data = await res.json();

  if (!data.status) {
    throw new Error(`Nomba rejected virtual account: ${data.description}`);
  }

  return {
    accountNumber: data.data.bankAccountNumber,
    bankName: data.data.bankName,
    accountRef: data.data.accountRef,
  };
}

export async function listVirtualAccounts(): Promise<
  NombaVirtualAccountResponse[]
> {
  const token = await getValidToken();

  const res = await fetch(`${NOMBA_API_URL}/accounts/virtual`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      accountId: process.env.NOMBA_ACCOUNT_ID ?? '',
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(
      `Failed to list virtual accounts: ${res.status} ${errorBody}`
    );
  }

  const data = await res.json();
  return data.responseBody ?? [];
}
