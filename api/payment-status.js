import crypto from 'node:crypto';

/**
 * Vercel Serverless Function: Check PhonePe Payment Status
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
      console.error('PhonePe status error:', phonepeData);
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}
