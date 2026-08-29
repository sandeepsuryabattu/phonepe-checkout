import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: Initiate PhonePe Payment
 * Endpoint: POST /api/initiate-payment
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { name, email, mobile, amount } = req.body || {};

    if (!name || !email || !mobile || !amount) {
      return res.status(400).json({ error: 'Missing required fields: name, email, mobile, amount' });
    }

    if (Number(amount) < 100) {
      return res.status(400).json({ error: 'Minimum amount is ₹1 (100 paise)' });
    }

    const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT86';
    const saltKey = process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const apiUrl = process.env.PHONEPE_API_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    
    // In Vercel, VERCEL_URL is available automatically (e.g. your-app.vercel.app)
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const frontendUrl = process.env.FRONTEND_URL || `${proto}://${host}`;

    const merchantTransactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const merchantUserId = `USER_${crypto.createHash('md5').update(email).digest('hex').slice(0, 12)}`;

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

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    const stringToHash = base64Payload + '/pg/v1/pay' + saltKey;
    const checksum = crypto.createHash('sha256').update(stringToHash).digest('hex') + '###' + saltIndex;

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
      return res.status(502).json({
        error: phonepeData.message || 'Payment initiation failed',
        code: phonepeData.code,
      });
    }

    const redirectUrl = phonepeData.data?.instrumentResponse?.redirectInfo?.url;

    if (!redirectUrl) {
      console.error('No redirect URL in PhonePe response:', phonepeData);
      return res.status(502).json({ error: 'No payment URL received' });
    }

    return res.status(200).json({
      redirectUrl,
      merchantTransactionId,
    });
  } catch (err) {
    console.error('initiate-payment error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
