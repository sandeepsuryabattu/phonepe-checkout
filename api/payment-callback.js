import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: PhonePe Payment Callback Webhook
 * Endpoint: POST /api/payment-callback
 */
export default async function handler(req, res) {
  // Allow GET/HEAD for webhook verification pings
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({ status: 'active', service: 'cissberry-webhook' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const receivedChecksum = req.headers['x-verify'];
    const authHeader = req.headers['authorization'];
    const body = req.body || {};

    console.log('PhonePe Webhook Notification Received:', {
      headers: {
        'x-verify': receivedChecksum,
        authorization: authHeader ? 'present' : 'none',
      },
      bodyKeys: Object.keys(body),
    });

    // Handle V2 direct JSON body vs V1 base64 body
    let payload = body;
    if (body.response && typeof body.response === 'string') {
      try {
        payload = JSON.parse(Buffer.from(body.response, 'base64').toString('utf-8'));
      } catch (e) {
        console.warn('Could not parse base64 response:', e);
      }
    }

    console.log('Decoded Webhook Payload:', JSON.stringify(payload, null, 2));

    // Acknowledge receipt with 200 OK
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (err) {
    console.error('payment-callback error:', err);
    // Still return 200 to prevent webhook retry flooding
    return res.status(200).json({ success: false, error: err.message });
  }
}
