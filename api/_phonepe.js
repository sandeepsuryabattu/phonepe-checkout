import crypto from 'node:crypto';

// In-memory token cache across function invocations
let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Get OAuth Access Token from PhonePe (V2)
 */
export async function getPhonePeAuthToken() {
  const now = Date.now();
  if (cachedToken && tokenExpiresAt > now + 60000) {
    return cachedToken;
  }

  const clientId = process.env.PHONEPE_CLIENT_ID;
  const clientSecret = process.env.PHONEPE_CLIENT_SECRET;
  const clientVersion = process.env.PHONEPE_CLIENT_VERSION || '1';
  const isProd = process.env.PHONEPE_ENV === 'production' || process.env.NODE_ENV === 'production';

  const tokenUrl = isProd
    ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

  const formParams = new URLSearchParams();
  formParams.append('client_id', clientId);
  formParams.append('client_version', clientVersion);
  formParams.append('client_secret', clientSecret);
  formParams.append('grant_type', 'client_credentials');

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formParams.toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(data.message || data.error_description || 'Failed to obtain PhonePe OAuth token');
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

  return cachedToken;
}

/**
 * Checks if V2 (OAuth) credentials are configured
 */
export function isV2Configured() {
  return Boolean(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET);
}
