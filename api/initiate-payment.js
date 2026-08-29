import crypto from 'node:crypto';
import { getPhonePeAuthToken, isV2Configured } from './_phonepe.js';

/**
 * Vercel Serverless Function: Initiate PhonePe Payment (V2 OAuth + V1 fallback)
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

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const frontendUrl = process.env.FRONTEND_URL || `${proto}://${host}`;
    const merchantTransactionId = `TXN_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const redirectUrl = `${frontendUrl}/payment-status?txnId=${merchantTransactionId}`;
    const isProd = process.env.PHONEPE_ENV === 'production' || process.env.NODE_ENV === 'production';

    // ==========================================
    // V2 FLOW (Latest: OAuth 2.0 with Client ID & Secret)
    // ==========================================
    if (isV2Configured()) {
      const token = await getPhonePeAuthToken();
      const payUrl = isProd
        ? 'https://api.phonepe.com/apis/pg/checkout/v2/pay'
        : 'https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay';

      const payload = {
        merchantOrderId: merchantTransactionId,
        amount: Number(amount),
        expireAfter: 1200,
        paymentFlow: {
          type: 'PG_CHECKOUT',
          merchantUrls: {
            redirectUrl: redirectUrl,
          },
        },
        metaInfo: {
          udf1: name,
          udf2: email,
          udf3: mobile,
        },
      };

      const response = await fetch(payUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || !data.redirectUrl) {
        console.error('PhonePe V2 Error:', data);
        return res.status(502).json({
          error: data.message || 'Payment initiation failed',
          code: data.code,
        });
      }

      return res.status(200).json({
        redirectUrl: data.redirectUrl,
        merchantTransactionId,
        orderId: data.orderId,
      });
    }

    // ==========================================
    // V1 FLOW (Legacy: SHA256 Checksum + Salt Key)
    // ==========================================
    const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT86';
    const saltKey = process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const apiUrl = process.env.PHONEPE_API_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    const merchantUserId = `USER_${crypto.createHash('md5').update(email).digest('hex').slice(0, 12)}`;

    const v1Payload = {
      merchantId,
      merchantTransactionId,
      merchantUserId,
      amount: Number(amount),
      redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: `${frontendUrl}/api/payment-callback`,
      mobileNumber: mobile,
      paymentInstrument: {
        type: 'PAY_PAGE',
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(v1Payload)).toString('base64');
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
      console.error('PhonePe V1 error:', phonepeData);
      return res.status(502).json({
        error: phonepeData.message || 'Payment initiation failed',
        code: phonepeData.code,
      });
    }

    const v1RedirectUrl = phonepeData.data?.instrumentResponse?.redirectInfo?.url;

    if (!v1RedirectUrl) {
      return res.status(502).json({ error: 'No payment URL received' });
    }

    return res.status(200).json({
      redirectUrl: v1RedirectUrl,
      merchantTransactionId,
    });
  } catch (err) {
    console.error('initiate-payment error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
