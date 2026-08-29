import crypto from 'node:crypto';

/**
 * Netlify Function: Check PhonePe Payment Status
 *
 * Called by the frontend after redirect to verify the actual
 * transaction status server-side (never trust the redirect alone).
 */
export default async function handler(request, context) {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(request.url);
    const txnId = url.searchParams.get('txnId');

    if (!txnId) {
      return new Response(
        JSON.stringify({ error: 'Missing txnId query parameter' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const apiUrl = process.env.PHONEPE_API_URL;

    if (!merchantId || !saltKey || !apiUrl) {
      console.error('Missing PhonePe environment variables');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build checksum for status API
    // Formula: SHA256("/pg/v1/status/{merchantId}/{merchantTransactionId}" + saltKey) + "###" + saltIndex
    const statusPath = `/pg/v1/status/${merchantId}/${txnId}`;
    const stringToHash = statusPath + saltKey;
    const checksum =
      crypto.createHash('sha256').update(stringToHash).digest('hex') +
      '###' +
      saltIndex;

    // Call PhonePe Status API
    const phonepeResponse = await fetch(`${apiUrl}${statusPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': merchantId,
      },
    });

    const phonepeData = await phonepeResponse.json();

    if (!phonepeData.success && phonepeData.code !== 'PAYMENT_PENDING') {
      console.error('PhonePe status error:', phonepeData);
      return new Response(
        JSON.stringify({
          state: 'FAILED',
          merchantTransactionId: txnId,
          error: phonepeData.message || 'Status check failed',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Return normalised status to frontend
    const data = phonepeData.data || {};

    return new Response(
      JSON.stringify({
        state: data.state || (phonepeData.code === 'PAYMENT_SUCCESS' ? 'COMPLETED' : 'FAILED'),
        merchantTransactionId: data.merchantTransactionId || txnId,
        transactionId: data.transactionId || null,
        amount: data.amount || null,
        paymentInstrument: data.paymentInstrument || null,
        responseCode: data.responseCode || phonepeData.code,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('payment-status error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  path: '/api/payment-status',
};
