import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: PhonePe Payment Callback Webhook
 * Endpoint: POST /api/payment-callback
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const receivedChecksum = req.headers['x-verify'];
    const saltKey = process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

    const base64Response = req.body?.response;

    if (!base64Response) {
      console.error('No response field in callback body');
      return res.status(400).send('Bad request');
    }

    const stringToHash = base64Response + '/pg/v1/pay' + saltKey;
    const expectedChecksum = crypto.createHash('sha256').update(stringToHash).digest('hex') + '###' + saltIndex;

    if (receivedChecksum && receivedChecksum !== expectedChecksum) {
      console.error('Checksum mismatch — possible spoofed callback', {
        received: receivedChecksum,
        expected: expectedChecksum,
      });
      return res.status(401).send('Unauthorized');
    }

    const decodedResponse = JSON.parse(
      Buffer.from(base64Response, 'base64').toString('utf-8')
    );

    console.log('✅ Verified PhonePe callback:', JSON.stringify(decodedResponse, null, 2));

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('payment-callback error:', err);
    return res.status(500).send('Internal server error');
  }
}
