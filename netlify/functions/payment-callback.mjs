import crypto from 'node:crypto';

/**
 * Netlify Function: PhonePe Payment Callback (Webhook)
 *
 * Receives server-to-server webhook from PhonePe after payment completion.
 * Verifies the X-VERIFY header to prevent spoofed callbacks.
 */
export default async function handler(request, context) {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const receivedChecksum = request.headers.get('X-VERIFY');

    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';

    if (!saltKey) {
      console.error('Missing PHONEPE_SALT_KEY for callback verification');
      return new Response('Server configuration error', { status: 500 });
    }

    // The callback body contains { response: "<base64 encoded response>" }
    const base64Response = body.response;

    if (!base64Response) {
      console.error('No response field in callback body');
      return new Response('Bad request', { status: 400 });
    }

    // Verify checksum
    // Formula: SHA256(response + "/pg/v1/pay" + saltKey) + "###" + saltIndex
    const stringToHash = base64Response + '/pg/v1/pay' + saltKey;
    const expectedChecksum =
      crypto.createHash('sha256').update(stringToHash).digest('hex') +
      '###' +
      saltIndex;

    if (receivedChecksum !== expectedChecksum) {
      console.error('Checksum mismatch — possible spoofed callback', {
        received: receivedChecksum,
        expected: expectedChecksum,
      });
      return new Response('Unauthorized', { status: 401 });
    }

    // Decode the response
    const decodedResponse = JSON.parse(
      Buffer.from(base64Response, 'base64').toString('utf-8')
    );

    console.log('✅ Verified PhonePe callback:', JSON.stringify(decodedResponse, null, 2));

    // In a production app, you would:
    // 1. Update order status in your database
    // 2. Send confirmation email
    // 3. Trigger fulfillment
    // For now, we just log and acknowledge

    const txnState = decodedResponse?.data?.state;
    const txnId = decodedResponse?.data?.merchantTransactionId;

    console.log(`Transaction ${txnId}: ${txnState}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('payment-callback error:', err);
    return new Response('Internal server error', { status: 500 });
  }
}

export const config = {
  path: '/api/payment-callback',
};
