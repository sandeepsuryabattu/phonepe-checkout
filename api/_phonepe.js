import crypto from 'node:crypto';

// Cached token in memory
let cachedTokenData = null; // { token, expiresAt, baseUrl }

/**
 * Get OAuth Access Token from PhonePe Production Identity Manager
 */
export async function getPhonePeAuth() {
  const now = Date.now();
  if (cachedTokenData && cachedTokenData.expiresAt > now + 60000) {
    return cachedTokenData;
  }

  const clientId = (process.env.PHONEPE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PHONEPE_CLIENT_SECRET || '').trim();
  const clientVersion = (process.env.PHONEPE_CLIENT_VERSION || '1').trim();

  const formParams = new URLSearchParams();
  formParams.append('client_id', clientId);
  formParams.append('client_version', clientVersion);
  formParams.append('client_secret', clientSecret);
  formParams.append('grant_type', 'client_credentials');

  const prodTokenUrl = 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token';
  const response = await fetch(prodTokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formParams.toString(),
  });

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error('PhonePe Production token error:', data);
    throw new Error(data.message || data.error_description || 'Failed to authenticate with PhonePe Production');
  }

  cachedTokenData = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1000,
    baseUrl: 'https://api.phonepe.com/apis/pg',
  };

  return cachedTokenData;
}

export function isV2Configured() {
  return Boolean(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET);
}
