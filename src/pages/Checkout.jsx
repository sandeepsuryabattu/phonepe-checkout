import { useState } from 'react';

function Checkout() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    amount: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/initiate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          mobile: form.mobile,
          amount: Math.round(parseFloat(form.amount) * 100), // Convert ₹ to paise
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || 'Failed to initiate payment');
      }

      // Redirect to PhonePe payment page
      window.location.href = data.redirectUrl;
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="checkout-container">
      <div className="checkout-card">
        <div className="checkout-header">
          <h1>Checkout</h1>
          <p>Complete your payment securely with PhonePe</p>
        </div>

        <form onSubmit={handleSubmit} className="checkout-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="John Doe"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="john@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="mobile">Mobile Number</label>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              placeholder="9876543210"
              pattern="[6-9][0-9]{9}"
              title="Enter a valid 10-digit Indian mobile number"
              value={form.mobile}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="amount">Amount (₹)</label>
            <div className="amount-input-wrapper">
              <span className="currency-symbol">₹</span>
              <input
                id="amount"
                name="amount"
                type="number"
                min="1"
                step="0.01"
                placeholder="100.00"
                value={form.amount}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="pay-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />
                Redirecting to PhonePe…
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Pay with PhonePe
              </>
            )}
          </button>
        </form>

        <div className="checkout-footer">
          <div className="secure-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Secured by PhonePe Payment Gateway</span>
          </div>
          <div className="payment-methods">
            <span>UPI</span>
            <span>Cards</span>
            <span>Net Banking</span>
            <span>Wallets</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Checkout;
