import { Routes, Route } from 'react-router-dom';
import Checkout from './pages/Checkout';
import PaymentStatus from './pages/PaymentStatus';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
          <span>PayCheckout</span>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Checkout />} />
          <Route path="/payment-status" element={<PaymentStatus />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>Powered by PhonePe · Sandbox Mode</p>
      </footer>
    </div>
  );
}

export default App;
