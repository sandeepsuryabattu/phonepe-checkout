/**
 * Temporary diagnostic endpoint to check PhonePe API responses
 * Endpoint: GET /api/debug-auth
 */
export default async function handler(req, res) {
  const clientId = (process.env.PHONEPE_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PHONEPE_CLIENT_SECRET || '').trim();
  const clientVersion = (process.env.PHONEPE_CLIENT_VERSION || '1').trim();
  const env = (process.env.PHONEPE_ENV || '').trim();

  const formParams = new URLSearchParams();
  formParams.append('client_id', clientId);
  formParams.append('client_version', clientVersion);
  formParams.append('client_secret', clientSecret);
  formParams.append('grant_type', 'client_credentials');

  const results = {};

  // 1. Try Production Identity Manager
  try {
    const prodRes = await fetch('https://api.phonepe.com/apis/identity-manager/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString(),
    });
    results.production_identity_manager = {
      status: prodRes.status,
      data: await prodRes.json(),
    };
  } catch (e) {
    results.production_identity_manager = { error: e.message };
  }

  // 2. Try Production PG OAuth
  try {
    const pgRes = await fetch('https://api.phonepe.com/apis/pg/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString(),
    });
    results.production_pg = {
      status: pgRes.status,
      data: await pgRes.json(),
    };
  } catch (e) {
    results.production_pg = { error: e.message };
  }

  // 3. Try Sandbox PG OAuth
  try {
    const sandRes = await fetch('https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formParams.toString(),
    });
    results.sandbox = {
      status: sandRes.status,
      data: await sandRes.json(),
    };
  } catch (e) {
    results.sandbox = { error: e.message };
  }

  return res.status(200).json({
    config: {
      has_client_id: Boolean(clientId),
      client_id_prefix: clientId ? clientId.substring(0, 4) + '...' : 'none',
      client_version: clientVersion,
      env: env,
    },
    results,
  });
}
