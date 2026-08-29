import crypto from 'node:crypto';

/**
 * Netlify Function: Initiate PhonePe Payment
 *
 * Receives checkout details from the frontend, builds a signed PhonePe
 * PAY_PAGE request, and returns the redirect URL.
 */
export default async function handler(request, context) {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { name, email, mobile, amount } = body;

    // Validate required fields
    if (!name || !email || !mobile || !amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, mobile, amount' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (amount < 100) {
      return new Response(
        JSON.stringify({ error: 'Minimum amount is ₹1 (100 paise)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Environment variables
    const merchantId = process.env.PHONEPE_MERCHANT_ID;
    const saltKey = process.env.PHONEPE_SALT_KEY;
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const apiUrl = process.env.PHONEPE_API_URL;
    const frontendUrl = process.env.FRONTEND_URL || process.env.URL; // Netlify sets URL automatically

    if (!merchantId || !saltKey || !apiUrl) {
      console.error('Missing PhonePe environment variables');
      return new Response(
        JSON.stringify({ error: 'Payment gateway not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique transaction ID
    const merchantTransactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const merchantUserId = `USER_${crypto.createHash('md5').update(email).digest('hex').slice(0, 12)}`;

    // Build PhonePe payload
    const payload = {
      merchantId,
      merchantTransactionId,
      merchantUserId,
      amount: Number(amount),
      redirectUrl: `${frontendUrl}/payment-status?txnId=${merchantTransactionId}`,
      redirectMode: 'REDIRECT',
      callbackUrl: `${frontendUrl}/api/payment-callback`,
      mobileNumber: mobile,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    // Base64 encode the payload
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');

    // Generate X-VERIFY checksum
    // Formula: SHA256(base64Payload + "/pg/v1/pay" + saltKey) + "###" + saltIndex
    const stringToHash = base64Payload + '/pg/v1/pay' + saltKey;
    const checksum =
      crypto.createHash('sha256').update(stringToHash).digest('hex') +
      '###' +
      saltIndex;

    // Call PhonePe Pay API
    const phonepeResponse = await fetch(`${apiUrl}/pg/v1/pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
      },
      body: JSON.stringify({ request: base64Payload }),
    });

    const phonepeData = await phonepeResponse.json();

    if (!phonepeData.success) {
      console.error('PhonePe error:', phonepeData);
      return new Response(
        JSON.stringify({
          error: phonepeData.message || 'Payment initiation failed',
          code: phonepeData.code,
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract redirect URL from the response
    const redirectUrl =
      phonepeData.data?.instrumentResponse?.redirectInfo?.url;

    if (!redirectUrl) {
      console.error('No redirect URL in PhonePe response:', phonepeData);
      return new Response(
        JSON.stringify({ error: 'No payment URL received' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        redirectUrl,
        merchantTransactionId,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('initiate-payment error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export const config = {
  path: '/api/initiate-payment',
};
