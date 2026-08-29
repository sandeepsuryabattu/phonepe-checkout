import crypto from 'node:crypto';
import { getPhonePeAuthToken, isV2Configured } from './_phonepe.js';

/**
 * Vercel Serverless Function: Check PhonePe Payment Status (V2 OAuth + V1 fallback)
 * Endpoint: GET /api/payment-status?txnId=...
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const txnId = req.query.txnId;

    if (!txnId) {
      return res.status(400).json({ error: 'Missing txnId query parameter' });
    }

    const isProd = process.env.PHONEPE_ENV === 'production' || process.env.NODE_ENV === 'production';

    // ==========================================
    // V2 FLOW (Latest: OAuth 2.0 Status Check)
    // ==========================================
    if (isV2Configured()) {
      const token = await getPhonePeAuthToken();
      const statusUrl = isProd
        ? `https://api.phonepe.com/apis/pg/checkout/v2/order/${txnId}/status?details=true&errorContext=true`
        : `https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/order/${txnId}/status?details=true&errorContext=true`;

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `O-Bearer ${token}`,
        },
      });

      const data = await response.json();

      return res.status(200).json({
        state: data.state || (response.ok ? 'COMPLETED' : 'FAILED'),
        merchantTransactionId: txnId,
        orderId: data.orderId || null,
        transactionId: data.paymentDetails?.[0]?.transactionId || data.orderId || null,
        amount: data.amount || null,
        paymentInstrument: {
          type: data.paymentDetails?.[0]?.paymentMode || 'PHONEPE',
        },
        responseCode: data.state,
      });
    }

    // ==========================================
    // V1 FLOW (Legacy: SHA256 Status Check)
    // ==========================================
    const merchantId = process.env.PHONEPE_MERCHANT_ID || 'PGTESTPAYUAT86';
    const saltKey = process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const apiUrl = process.env.PHONEPE_API_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    const statusPath = `/pg/v1/status/${merchantId}/${txnId}`;
    const stringToHash = statusPath + saltKey;
    const checksum = crypto.createHash('sha256').update(stringToHash).digest('hex') + '###' + saltIndex;

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
      return res.status(200).json({
        state: 'FAILED',
        merchantTransactionId: txnId,
        error: phonepeData.message || 'Status check failed',
      });
    }

    const data = phonepeData.data || {};

    return res.status(200).json({
      state: data.state || (phonepeData.code === 'PAYMENT_SUCCESS' ? 'COMPLETED' : 'FAILED'),
      merchantTransactionId: data.merchantTransactionId || txnId,
      transactionId: data.transactionId || null,
      amount: data.amount || null,
      paymentInstrument: data.paymentInstrument || null,
      responseCode: data.responseCode || phonepeData.code,
    });
  } catch (err) {
    console.error('payment-status error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
