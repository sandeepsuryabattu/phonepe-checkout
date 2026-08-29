import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';

function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(null); // null = loading
  const [error, setError] = useState('');

  const txnId = searchParams.get('txnId');

  useEffect(() => {
    if (!txnId) {
      setError('No transaction ID found in URL.');
      return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/payment-status?txnId=${encodeURIComponent(txnId)}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Failed to fetch status');
        }

        setStatus(data);
      } catch (err) {
        setError(err.message || 'Something went wrong.');
      }
    };

    checkStatus();
  }, [txnId]);

  // Loading state
  if (!error && !status) {
    return (
      <div className="status-container">
        <div className="status-card">
          <div className="status-icon loading">
            <span className="spinner large" />
          </div>
          <h1>Verifying Payment…</h1>
          <p className="status-subtitle">Please wait while we confirm your transaction.</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="status-container">
        <div className="status-card">
          <div className="status-icon error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1>Something Went Wrong</h1>
          <p className="status-subtitle">{error}</p>
          <Link to="/" className="back-button">Try Again</Link>
        </div>
      </div>
    );
  }

  const state = status.state; // COMPLETED, FAILED, PENDING
  const isSuccess = state === 'COMPLETED';
  const isPending = state === 'PENDING';

  return (
    <div className="status-container">
      <div className="status-card">
        {/* Icon */}
        <div className={`status-icon ${isSuccess ? 'success' : isPending ? 'pending' : 'failed'}`}>
          {isSuccess ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ) : isPending ? (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ) : (
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          )}
        </div>

        {/* Heading */}
        <h1>
          {isSuccess
            ? 'Payment Successful!'
            : isPending
              ? 'Payment Pending'
              : 'Payment Failed'}
        </h1>
        <p className="status-subtitle">
          {isSuccess
            ? 'Your transaction has been completed successfully.'
            : isPending
              ? 'Your payment is still being processed. Please check back shortly.'
              : 'Your payment could not be processed. Please try again.'}
        </p>

        {/* Details */}
        <div className="txn-details">
          <div className="detail-row">
            <span>Transaction ID</span>
            <span className="detail-value">{status.merchantTransactionId || txnId}</span>
          </div>
          {status.transactionId && (
            <div className="detail-row">
              <span>PhonePe Ref</span>
              <span className="detail-value">{status.transactionId}</span>
            </div>
          )}
          {status.amount && (
            <div className="detail-row">
              <span>Amount</span>
              <span className="detail-value">₹{(status.amount / 100).toFixed(2)}</span>
            </div>
          )}
          {status.paymentInstrument?.type && (
            <div className="detail-row">
              <span>Paid Via</span>
              <span className="detail-value">{status.paymentInstrument.type}</span>
            </div>
          )}
        </div>

        <Link to="/" className="back-button">
          {isSuccess ? 'Make Another Payment' : 'Try Again'}
        </Link>
      </div>
    </div>
  );
}

export default PaymentStatus;
