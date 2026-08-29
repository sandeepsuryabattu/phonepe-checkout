import crypto from 'node:crypto';

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

  const clientId = (process.env.PHONEPE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PHONEPE_CLIENT_SECRET || '').trim();
  const clientVersion = (process.env.PHONEPE_CLIENT_VERSION || '1').trim();
  const envSetting = (process.env.PHONEPE_ENV || '').trim().toLowerCase();

  const isProd = envSetting === 'production';

  // Primary URL based on PHONEPE_ENV
  const primaryUrl = isProd
    ? 'https://api.phonepe.com/apis/identity-manager/v1/oauth/token'
    : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

  const formParams = new URLSearchParams();
  formParams.append('client_id', clientId);
  formParams.append('client_version', clientVersion);
  formParams.append('client_secret', clientSecret);
  formParams.append('grant_type', 'client_credentials');

  let response = await fetch(primaryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formParams.toString(),
  });

  let data = await response.json();

  // If production returned Client Not Found (e.g. keys belong to sandbox/UAT), try sandbox URL
  if (!response.ok && isProd && (data.message || '').includes('Client Not Found')) {
    console.log('Production token endpoint returned Client Not Found. Trying Sandbox token endpoint...');
    const sandboxUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
    const fallbackRes = await fetch(sandboxUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formParams.toString(),
    });
    const fallbackData = await fallbackRes.json();
    if (fallbackRes.ok && fallbackData.access_token) {
      cachedToken = fallbackData.access_token;
      tokenExpiresAt = now + (fallbackData.expires_in || 3600) * 1000;
      return cachedToken;
    }
  }

  if (!response.ok || !data.access_token) {
    console.error('PhonePe OAuth Token Error:', data);
    throw new Error(data.message || data.error_description || JSON.stringify(data));
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;

  return cachedToken;
}

export function isV2Configured() {
  return Boolean(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET);
}
